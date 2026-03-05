"""
GitHub Poller — polls GitHub API for PR metrics of registered agents.

Runs as a background job in the autonomous scheduler. Extracts GitHub repo
URLs from agent metadata (agent_uri, endpoints), fetches PR activity, and
computes coding reputation metrics (merge rate, revert rate, review sentiment,
time-to-merge). Results stored in git_activity table and fed into composite
scoring as an optional 9th signal.
"""

import re
import time
import logging
from datetime import datetime, timezone, timedelta

import httpx

from database import get_supabase

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"
# Rate-limit: 750ms between API calls to stay well within 5000/hr PAT limit
API_DELAY = 0.75
# Max repos to process per poller cycle
MAX_REPOS_PER_CYCLE = 200
# Re-poll interval: skip repos polled within this window
REPOLL_HOURS = 6

# Regex to extract "owner/repo" from GitHub URLs
_GITHUB_REPO_RE = re.compile(
    r"(?:https?://)?(?:www\.)?github\.com/([a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+)"
)


class GitHubPoller:
    """Polls GitHub for PR metrics of agents with GitHub repos in their metadata."""

    def __init__(self, github_token: str = ""):
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if github_token:
            headers["Authorization"] = f"Bearer {github_token}"
        self._client = httpx.Client(
            base_url=GITHUB_API,
            headers=headers,
            timeout=15,
            follow_redirects=True,
        )

    def close(self):
        self._client.close()

    def poll_agent_repos(self) -> int:
        """Main entry point — scan agents for GitHub repos and fetch PR metrics.

        Returns count of agents updated.
        """
        db = get_supabase()
        updated = 0

        # Find agents with GitHub URLs in their metadata
        agents_with_repos = self._find_agents_with_github(db)
        if not agents_with_repos:
            return 0

        logger.info(f"[github] Found {len(agents_with_repos)} agents with GitHub repos")

        for agent_id, source_chain, repo in agents_with_repos[:MAX_REPOS_PER_CYCLE]:
            try:
                # Check if recently polled
                if self._recently_polled(db, agent_id, source_chain, repo):
                    continue

                metrics = self._fetch_repo_metrics(repo)
                if metrics is None:
                    continue

                self._upsert_activity(db, agent_id, source_chain, repo, metrics)
                updated += 1
            except Exception as e:
                logger.warning(f"[github] Error processing {repo} for agent {agent_id}: {e}")
                continue

        return updated

    def _find_agents_with_github(self, db) -> list[tuple[int, str, str]]:
        """Find agents that have GitHub repo URLs in their metadata.

        Returns list of (agent_id, source_chain, "owner/repo").
        """
        results: list[tuple[int, str, str]] = []

        # Query agents with GitHub URLs in agent_uri or metadata
        # Search across agent_uri and raw metadata for github.com links
        try:
            query_result = (
                db.table("agents")
                .select("agent_id, source_chain, agent_uri, name, description")
                .like("agent_uri", "%github.com%")
                .limit(500)
                .execute()
            )
            agents = query_result.data or []
        except Exception as e:
            logger.warning(f"[github] Failed to query agents with GitHub URLs: {e}")
            agents = []

        for agent in agents:
            repos = self._extract_github_repos(agent)
            chain = agent.get("source_chain", "avalanche")
            for repo in repos:
                results.append((agent["agent_id"], chain, repo))

        return results

    def _extract_github_repos(self, agent: dict) -> list[str]:
        """Extract GitHub "owner/repo" strings from agent metadata."""
        repos: set[str] = set()

        # Search agent_uri for GitHub links
        uri = agent.get("agent_uri", "") or ""
        for match in _GITHUB_REPO_RE.finditer(uri):
            repo = match.group(1).rstrip("/").rstrip(".git")
            # Skip common non-repo paths
            if "/" in repo and not any(
                repo.endswith(s)
                for s in ["/issues", "/pulls", "/actions", "/settings"]
            ):
                repos.add(repo)

        # Also check name/description for github.com links
        for field in ["name", "description"]:
            text = agent.get(field, "") or ""
            for match in _GITHUB_REPO_RE.finditer(text):
                repo = match.group(1).rstrip("/").rstrip(".git")
                if "/" in repo:
                    repos.add(repo)

        return list(repos)

    def _recently_polled(self, db, agent_id: int, source_chain: str, repo: str) -> bool:
        """Check if this repo was polled within REPOLL_HOURS."""
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=REPOLL_HOURS)).isoformat()
        try:
            result = (
                db.table("git_activity")
                .select("last_polled_at")
                .eq("agent_id", agent_id)
                .eq("source_chain", source_chain)
                .eq("github_repo", repo)
                .gte("last_polled_at", cutoff)
                .limit(1)
                .execute()
            )
            return bool(result.data)
        except Exception:
            return False

    def _fetch_repo_metrics(self, repo: str) -> dict | None:
        """Fetch PR metrics for a GitHub repo.

        Returns dict with: total_prs, merged_prs, rejected_prs, reverted_prs,
        avg_time_to_merge_hours, avg_review_score, last_commit_at, raw_data.
        """
        # Fetch recent PRs (last 100, all states)
        time.sleep(API_DELAY)
        try:
            resp = self._client.get(
                f"/repos/{repo}/pulls",
                params={"state": "all", "sort": "updated", "per_page": 100},
            )
            if resp.status_code == 404:
                logger.debug(f"[github] Repo {repo} not found (404)")
                return None
            if resp.status_code == 403:
                logger.warning(f"[github] Rate limited on {repo}")
                return None
            resp.raise_for_status()
            prs = resp.json()
        except httpx.HTTPStatusError as e:
            logger.warning(f"[github] HTTP error fetching PRs for {repo}: {e}")
            return None

        if not prs:
            return {
                "total_prs": 0,
                "merged_prs": 0,
                "rejected_prs": 0,
                "reverted_prs": 0,
                "avg_time_to_merge_hours": 0,
                "avg_review_score": 0,
                "last_commit_at": None,
                "raw_data": {},
            }

        total = len(prs)
        merged = 0
        rejected = 0
        reverted = 0
        merge_times: list[float] = []
        review_scores: list[float] = []

        for pr in prs:
            state = pr.get("state", "")
            merged_at = pr.get("merged_at")

            if merged_at:
                merged += 1
                # Calculate time-to-merge
                created = datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00"))
                merged_dt = datetime.fromisoformat(merged_at.replace("Z", "+00:00"))
                hours = (merged_dt - created).total_seconds() / 3600
                merge_times.append(hours)

                # Check for revert indicators
                title = (pr.get("title") or "").lower()
                if "revert" in title:
                    reverted += 1
            elif state == "closed":
                rejected += 1

            # Fetch reviews for merged/closed PRs (sample up to 10 to conserve API calls)
            if (merged_at or state == "closed") and len(review_scores) < 10:
                pr_number = pr.get("number")
                if pr_number:
                    score = self._fetch_review_sentiment(repo, pr_number)
                    if score is not None:
                        review_scores.append(score)

        # Compute averages
        avg_merge_hours = 0.0
        if merge_times:
            merge_times.sort()
            mid = len(merge_times) // 2
            avg_merge_hours = merge_times[mid]  # median

        avg_review = 0.0
        if review_scores:
            avg_review = sum(review_scores) / len(review_scores)

        # Last commit timestamp
        last_commit_at = None
        if prs:
            updated = prs[0].get("updated_at") or prs[0].get("created_at")
            if updated:
                last_commit_at = updated

        return {
            "total_prs": total,
            "merged_prs": merged,
            "rejected_prs": rejected,
            "reverted_prs": reverted,
            "avg_time_to_merge_hours": round(avg_merge_hours, 2),
            "avg_review_score": round(avg_review, 4),
            "last_commit_at": last_commit_at,
            "raw_data": {
                "sample_size": total,
                "merge_time_median_hours": round(avg_merge_hours, 2),
                "review_sample_count": len(review_scores),
            },
        }

    def _fetch_review_sentiment(self, repo: str, pr_number: int) -> float | None:
        """Fetch review sentiment for a PR. Returns -1 to 1 score or None."""
        time.sleep(API_DELAY)
        try:
            resp = self._client.get(
                f"/repos/{repo}/pulls/{pr_number}/reviews",
                params={"per_page": 30},
            )
            if resp.status_code != 200:
                return None
            reviews = resp.json()
        except Exception:
            return None

        if not reviews:
            return None

        # Score: APPROVED=+1, CHANGES_REQUESTED=-1, COMMENTED=0, DISMISSED=0
        sentiment_map = {
            "APPROVED": 1.0,
            "CHANGES_REQUESTED": -1.0,
            "COMMENTED": 0.0,
            "DISMISSED": 0.0,
        }

        scores = []
        for review in reviews:
            state = review.get("state", "")
            if state in sentiment_map:
                scores.append(sentiment_map[state])

        if not scores:
            return None
        return sum(scores) / len(scores)

    def _upsert_activity(
        self, db, agent_id: int, source_chain: str, repo: str, metrics: dict
    ):
        """Upsert git_activity row for this agent+repo."""
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "agent_id": agent_id,
            "source_chain": source_chain,
            "github_repo": repo,
            "total_prs": metrics["total_prs"],
            "merged_prs": metrics["merged_prs"],
            "rejected_prs": metrics["rejected_prs"],
            "reverted_prs": metrics["reverted_prs"],
            "avg_time_to_merge_hours": metrics["avg_time_to_merge_hours"],
            "avg_review_score": metrics["avg_review_score"],
            "last_commit_at": metrics.get("last_commit_at"),
            "last_polled_at": now,
            "raw_data": metrics.get("raw_data", {}),
            "updated_at": now,
        }

        try:
            db.table("git_activity").upsert(
                row,
                on_conflict="agent_id,source_chain,github_repo",
            ).execute()
        except Exception as e:
            # Table might not exist yet — log and continue
            logger.warning(f"[github] Failed to upsert git_activity for agent {agent_id}: {e}")


def compute_coding_score(activity: dict) -> float:
    """Compute a 0-100 coding reputation score from git_activity metrics.

    Components:
    - Merge rate (40%): what fraction of PRs get merged
    - Revert penalty (25%): low revert rate = good
    - Review sentiment (20%): positive reviews = good
    - Recency (15%): recent activity = good (decays over 90 days)
    """
    total_prs = activity.get("total_prs", 0) or 0
    if total_prs == 0:
        return 0.0

    merged = activity.get("merged_prs", 0) or 0
    reverted = activity.get("reverted_prs", 0) or 0
    review_score = activity.get("avg_review_score", 0) or 0  # -1 to 1

    merge_rate = merged / max(total_prs, 1)
    revert_penalty = reverted / max(merged, 1) if merged > 0 else 0

    # Recency: days since last commit
    recency_days = 90  # default to stale
    last_commit = activity.get("last_commit_at")
    if last_commit:
        try:
            if isinstance(last_commit, str):
                last_dt = datetime.fromisoformat(last_commit.replace("Z", "+00:00"))
            else:
                last_dt = last_commit
            recency_days = (datetime.now(timezone.utc) - last_dt).days
        except Exception:
            pass

    score = (
        merge_rate * 40
        + max(0, 1 - revert_penalty) * 25
        + (review_score + 1) / 2 * 20  # normalize -1..1 → 0..1
        + max(0, 1 - recency_days / 90) * 15
    )
    return round(min(100.0, max(0.0, score)), 2)
