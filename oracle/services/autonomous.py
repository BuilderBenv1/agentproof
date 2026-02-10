"""
Autonomous task scheduler for the Trust Oracle.

Runs background jobs inside the FastAPI process using asyncio tasks.
All Supabase calls are synchronous (supabase-py), so each job runs
via asyncio.to_thread to avoid blocking the event loop.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from collections import Counter
from urllib.parse import urlparse

import httpx

from database import get_supabase
from services.chain import get_chain_service

logger = logging.getLogger(__name__)

SCREEN_BATCH_SIZE = 50
ONCHAIN_FEEDBACK_LIMIT_PER_CYCLE = 5

# Map risk_level → on-chain score (1-100)
RISK_LEVEL_SCORES = {
    "low": 85,
    "medium": 60,
    "high": 30,
    "critical": 10,
}
LIVENESS_BATCH_SIZE = 20
LIVENESS_TIMEOUT = 10


class AgentScreener:
    """Autonomous background task scheduler for the Trust Oracle."""

    def __init__(self):
        self._running = False
        self._tasks: list[asyncio.Task] = []
        self.last_runs: dict[str, datetime] = {}
        self.job_counts: dict[str, int] = {
            "screen_new_agents": 0,
            "monitor_anomalies": 0,
            "verify_agent_liveness": 0,
            "publish_network_report": 0,
        }
        self.last_errors: dict[str, str] = {}

    async def start(self):
        """Launch all background jobs as asyncio tasks."""
        self._running = True
        logger.info("AgentScreener starting — 4 background jobs")
        self._tasks = [
            asyncio.create_task(self._loop("screen_new_agents", self._screen_new_agents, 300)),
            asyncio.create_task(self._loop("monitor_anomalies", self._monitor_anomalies, 900)),
            asyncio.create_task(self._loop("verify_agent_liveness", self._verify_agent_liveness, 3600)),
            asyncio.create_task(self._loop("publish_network_report", self._publish_network_report, 21600)),
        ]

    async def stop(self):
        """Cancel all background jobs."""
        self._running = False
        for t in self._tasks:
            t.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        logger.info("AgentScreener stopped")

    def status(self) -> dict:
        """Return current scheduler status for the /status endpoint."""
        return {
            "running": self._running,
            "jobs": {
                name: {
                    "runs": self.job_counts.get(name, 0),
                    "last_run": self.last_runs.get(name, None),
                    "last_error": self.last_errors.get(name, None),
                }
                for name in self.job_counts
            },
        }

    async def _loop(self, name: str, func, interval_seconds: int):
        """Generic loop: run func in thread, sleep, repeat."""
        # Stagger initial starts so jobs don't all hit Supabase simultaneously
        delays = {
            "screen_new_agents": 10,
            "monitor_anomalies": 30,
            "verify_agent_liveness": 60,
            "publish_network_report": 120,
        }
        await asyncio.sleep(delays.get(name, 5))

        while self._running:
            try:
                await asyncio.to_thread(func)
                self.last_runs[name] = datetime.now(timezone.utc)
                self.job_counts[name] += 1
                self.last_errors.pop(name, None)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[{name}] Error: {e}", exc_info=True)
                self.last_errors[name] = str(e)
            await asyncio.sleep(interval_seconds)

    # ─── Job 1: Screen New Agents (every 5 min) ──────────────────────

    def _screen_new_agents(self):
        """Screen agents that haven't been evaluated by the oracle yet.

        Prioritises Avalanche agents (agent_id <= 1621) first, then backfills
        with Ethereum agents (agent_id > 1621) up to SCREEN_BATCH_SIZE.
        """
        db = get_supabase()

        # Avalanche agents first (IDs 1-1621)
        avax_result = (
            db.table("agents")
            .select("agent_id, owner_address, registered_at, composite_score, total_feedback, tier")
            .is_("oracle_last_screened", "null")
            .lte("agent_id", 1621)
            .limit(SCREEN_BATCH_SIZE)
            .execute()
        )
        agents = avax_result.data or []

        # Backfill with Ethereum agents if room remains
        remaining = SCREEN_BATCH_SIZE - len(agents)
        if remaining > 0:
            eth_result = (
                db.table("agents")
                .select("agent_id, owner_address, registered_at, composite_score, total_feedback, tier")
                .is_("oracle_last_screened", "null")
                .gt("agent_id", 1621)
                .limit(remaining)
                .execute()
            )
            agents.extend(eth_result.data or [])

        if not agents:
            return
        logger.info(f"[screen_new_agents] Screening {len(agents)} unscreened agents")

        now = datetime.now(timezone.utc).isoformat()
        screening_rows = []

        for agent in agents:
            agent_id = agent["agent_id"]
            flags: list[str] = []

            feedback_count = agent.get("total_feedback", 0) or 0
            score = float(agent.get("composite_score", 0) or 0)

            if feedback_count == 0:
                flags.append("UNVERIFIED")
            elif feedback_count < 5:
                flags.append("LOW_FEEDBACK")

            if score < 50 and feedback_count > 0:
                flags.append("HIGH_RISK_SCORE")

            # Check feedback concentration
            if feedback_count >= 3:
                try:
                    fb_result = (
                        db.table("reputation_events")
                        .select("reviewer_address")
                        .eq("agent_id", agent_id)
                        .execute()
                    )
                    if fb_result.data:
                        counts = Counter(r["reviewer_address"] for r in fb_result.data)
                        top = counts.most_common(1)[0][1]
                        if top / len(fb_result.data) > 0.6:
                            flags.append("CONCENTRATED_FEEDBACK")
                except Exception:
                    pass

            if any(f in flags for f in ["HIGH_RISK_SCORE", "CONCENTRATED_FEEDBACK"]):
                risk_level = "high"
            elif "LOW_FEEDBACK" in flags:
                risk_level = "medium"
            else:
                risk_level = "low"

            screening_rows.append({
                "agent_id": agent_id,
                "risk_level": risk_level,
                "flags": flags,
                "screened_at": now,
            })

        if not screening_rows:
            return

        # Batch insert screenings
        try:
            db.table("oracle_screenings").insert(screening_rows).execute()
        except Exception as e:
            logger.error(f"[screen_new_agents] Failed to insert screenings: {e}")
            return

        # Mark each agent as screened (update only, not upsert)
        for r in screening_rows:
            try:
                db.table("agents").update(
                    {"oracle_last_screened": now}
                ).eq("agent_id", r["agent_id"]).execute()
            except Exception as e:
                logger.error(
                    f"[screen_new_agents] Failed to update oracle_last_screened "
                    f"for agent {r['agent_id']}: {e}"
                )

        logger.info(f"[screen_new_agents] Screened {len(screening_rows)} agents")

        # Submit on-chain feedback for screened agents (max 5 per cycle)
        chain = get_chain_service()
        if chain is not None:
            submitted = 0
            for row in screening_rows[:ONCHAIN_FEEDBACK_LIMIT_PER_CYCLE]:
                agent_id = row["agent_id"]
                risk_level = row["risk_level"]
                score = RISK_LEVEL_SCORES.get(risk_level, 60)
                flags_str = ", ".join(row["flags"]) if row["flags"] else "none"
                comment = f"Oracle screening: risk={risk_level}, flags=[{flags_str}]"

                try:
                    tx_hash = chain.submit_feedback(agent_id, score, comment)
                    if tx_hash:
                        submitted += 1
                        logger.info(
                            f"[screen_new_agents] On-chain feedback for agent {agent_id}: "
                            f"score={score} tx={tx_hash}"
                        )
                except Exception as e:
                    logger.error(
                        f"[screen_new_agents] On-chain feedback failed for agent {agent_id}: {e}"
                    )
                    # Don't block the screening loop
                    continue

            if submitted > 0:
                logger.info(f"[screen_new_agents] Submitted {submitted} on-chain feedbacks")

    # ─── Job 2: Monitor Anomalies (every 15 min) ─────────────────────

    def _monitor_anomalies(self):
        """Detect score anomalies and suspicious feedback patterns."""
        db = get_supabase()
        now = datetime.now(timezone.utc)
        cutoff_24h = (now - timedelta(hours=24)).isoformat()
        alerts: list[dict] = []

        # 1. Score volatility — agents whose score swung >15 points in 24h
        try:
            recent_history = (
                db.table("score_history")
                .select("agent_id, composite_score, snapshot_date")
                .gte("snapshot_date", cutoff_24h[:10])
                .order("snapshot_date", desc=True)
                .limit(1000)
                .execute()
            )
            if recent_history.data:
                agent_scores: dict[int, list[float]] = {}
                for h in recent_history.data:
                    aid = h["agent_id"]
                    if aid not in agent_scores:
                        agent_scores[aid] = []
                    agent_scores[aid].append(float(h["composite_score"]))

                for aid, scores in agent_scores.items():
                    if len(scores) >= 2:
                        swing = max(scores) - min(scores)
                        if swing > 15:
                            alerts.append({
                                "agent_id": aid,
                                "alert_type": "score_volatility",
                                "severity": "high" if swing > 30 else "medium",
                                "details": f"Score swung {swing:.1f} points in 24h ({min(scores):.1f}-{max(scores):.1f})",
                                "created_at": now.isoformat(),
                            })
        except Exception as e:
            logger.warning(f"[monitor_anomalies] Score history check failed: {e}")

        # 2. Feedback bursts — 5+ feedbacks from same reviewer to same agent in 24h
        recent_feedback_data: list[dict] = []
        try:
            recent_feedback = (
                db.table("reputation_events")
                .select("agent_id, reviewer_address, created_at")
                .gte("created_at", cutoff_24h)
                .limit(1000)
                .execute()
            )
            recent_feedback_data = recent_feedback.data or []

            if recent_feedback_data:
                pairs: dict[tuple, int] = {}
                for fb in recent_feedback_data:
                    key = (fb["agent_id"], fb["reviewer_address"])
                    pairs[key] = pairs.get(key, 0) + 1

                for (aid, reviewer), count in pairs.items():
                    if count >= 5:
                        alerts.append({
                            "agent_id": aid,
                            "alert_type": "feedback_burst",
                            "severity": "high",
                            "details": f"{count} feedbacks from {reviewer[:10]}...{reviewer[-4:]} in 24h",
                            "created_at": now.isoformat(),
                        })
        except Exception as e:
            logger.warning(f"[monitor_anomalies] Feedback burst check failed: {e}")

        # 3. Dormant agents suddenly receiving feedback
        try:
            if recent_feedback_data:
                recent_agents = set(fb["agent_id"] for fb in recent_feedback_data)

                for aid in list(recent_agents)[:50]:
                    older = (
                        db.table("reputation_events")
                        .select("id", count="exact")
                        .eq("agent_id", aid)
                        .lt("created_at", cutoff_24h)
                        .limit(0)
                        .execute()
                    )
                    recent_count = sum(1 for fb in recent_feedback_data if fb["agent_id"] == aid)

                    if (older.count or 0) == 0 and recent_count >= 3:
                        alerts.append({
                            "agent_id": aid,
                            "alert_type": "dormant_activation",
                            "severity": "medium",
                            "details": f"Previously inactive agent received {recent_count} feedbacks in 24h",
                            "created_at": now.isoformat(),
                        })
        except Exception as e:
            logger.warning(f"[monitor_anomalies] Dormant check failed: {e}")

        if alerts:
            try:
                db.table("oracle_alerts").insert(alerts).execute()
                logger.info(f"[monitor_anomalies] Created {len(alerts)} alerts")
            except Exception as e:
                logger.error(f"[monitor_anomalies] Failed to insert alerts: {e}")
        else:
            logger.info("[monitor_anomalies] No anomalies detected")

    # ─── Job 3: Verify Agent Liveness (every 60 min) ─────────────────

    def _verify_agent_liveness(self):
        """Check if agents with declared URLs are reachable."""
        db = get_supabase()
        now = datetime.now(timezone.utc)
        stale_cutoff = (now - timedelta(hours=6)).isoformat()

        # Find agents with web URLs that haven't been verified recently
        try:
            result = (
                db.table("agents")
                .select("agent_id, agent_uri")
                .like("agent_uri", "http%")
                .or_(f"last_verified.is.null,last_verified.lt.{stale_cutoff}")
                .limit(LIVENESS_BATCH_SIZE)
                .execute()
            )
        except Exception as e:
            if "does not exist" in str(e):
                logger.warning("[verify_agent_liveness] Columns missing — run oracle/migrations.sql")
            else:
                logger.error(f"[verify_agent_liveness] Query failed: {e}")
            return

        if not result.data:
            return

        agents_to_check = result.data
        logger.info(f"[verify_agent_liveness] Checking {len(agents_to_check)} agents")

        checked = 0
        with httpx.Client(timeout=LIVENESS_TIMEOUT, follow_redirects=True) as client:
            for agent in agents_to_check:
                agent_id = agent["agent_id"]
                uri = agent["agent_uri"]
                reachable = False

                try:
                    parsed = urlparse(uri)
                    base_url = f"{parsed.scheme}://{parsed.netloc}"

                    # Try /.well-known/agent.json first
                    try:
                        resp = client.get(f"{base_url}/.well-known/agent.json")
                        reachable = resp.status_code < 500
                    except (httpx.RequestError, httpx.TimeoutException):
                        # Fall back to base URL
                        try:
                            resp = client.get(base_url)
                            reachable = resp.status_code < 500
                        except (httpx.RequestError, httpx.TimeoutException):
                            reachable = False
                except Exception:
                    reachable = False

                try:
                    db.table("agents").update({
                        "last_verified": now.isoformat(),
                        "last_verified_reachable": reachable,
                    }).eq("agent_id", agent_id).execute()
                    checked += 1
                except Exception:
                    pass

        logger.info(f"[verify_agent_liveness] Checked {checked}/{len(agents_to_check)} agents")

    # ─── Job 4: Publish Network Report (every 6 hours) ───────────────

    def _publish_network_report(self):
        """Generate and store a periodic network health report."""
        db = get_supabase()
        now = datetime.now(timezone.utc)

        # Determine period start — since last report, or 6h ago
        period_start = (now - timedelta(hours=6)).isoformat()
        try:
            last_report = (
                db.table("oracle_reports")
                .select("period_end")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if last_report.data:
                period_start = last_report.data[0]["period_end"]
        except Exception:
            pass

        # Total agents
        total_result = (
            db.table("agents")
            .select("agent_id", count="exact")
            .limit(0)
            .execute()
        )
        total_agents = total_result.count or 0

        # New agents since last report
        new_result = (
            db.table("agents")
            .select("agent_id", count="exact")
            .gte("registered_at", period_start)
            .limit(0)
            .execute()
        )
        new_agents = new_result.count or 0

        # Avg trust score + tier distribution (paginated)
        all_scores: list[float] = []
        tier_dist: dict[str, int] = {}
        offset = 0
        while True:
            batch = (
                db.table("agents")
                .select("composite_score, tier")
                .range(offset, offset + 999)
                .execute()
            )
            if not batch.data:
                break
            for a in batch.data:
                score = float(a.get("composite_score") or 0)
                all_scores.append(score)
                t = a.get("tier", "unranked")
                tier_dist[t] = tier_dist.get(t, 0) + 1
            if len(batch.data) < 1000:
                break
            offset += 1000

        avg_score = round(sum(all_scores) / len(all_scores), 2) if all_scores else 0.0

        # Alerts since last report
        alerts_result = (
            db.table("oracle_alerts")
            .select("id", count="exact")
            .gte("created_at", period_start)
            .limit(0)
            .execute()
        )
        alerts_count = alerts_result.count or 0

        # Screenings since last report
        screenings_result = (
            db.table("oracle_screenings")
            .select("id", count="exact")
            .gte("screened_at", period_start)
            .limit(0)
            .execute()
        )
        screenings_count = screenings_result.count or 0

        report_data = {
            "total_agents": total_agents,
            "new_agents": new_agents,
            "avg_trust_score": avg_score,
            "tier_distribution": tier_dist,
            "alerts_issued": alerts_count,
            "agents_screened": screenings_count,
        }

        try:
            db.table("oracle_reports").insert({
                "report_data": report_data,
                "period_start": period_start,
                "period_end": now.isoformat(),
                "created_at": now.isoformat(),
            }).execute()
            logger.info(
                f"[publish_network_report] Published: {total_agents} agents, "
                f"{new_agents} new, {alerts_count} alerts, {screenings_count} screened"
            )
        except Exception as e:
            logger.error(f"[publish_network_report] Failed to insert report: {e}")


# Singleton
_screener: AgentScreener | None = None


def get_screener() -> AgentScreener:
    global _screener
    if _screener is None:
        _screener = AgentScreener()
    return _screener
