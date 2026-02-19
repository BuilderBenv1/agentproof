"""
TrustService — core business logic for the Trust Oracle Agent.
Queries Supabase (read-only) and computes trust evaluations, risk assessments,
and network statistics using the same scoring algorithm as the backend indexer.
"""

import math
import logging
import time
import threading
from datetime import datetime, timezone
from collections import Counter

from database import get_supabase
from models import (
    TrustEvaluation,
    TrustedAgent,
    RiskAssessment,
    NetworkStats,
    ScoreBreakdown,
    Recommendation,
    RiskFlag,
    RiskLevel,
)

logger = logging.getLogger(__name__)


# ─── In-memory TTL cache ─────────────────────────────────────────────

CACHE_TTL_SECONDS = 300  # 5 minutes — matches screener cycle


class TrustCache:
    """Thread-safe in-memory TTL cache for trust evaluations and network stats."""

    def __init__(self, ttl: int = CACHE_TTL_SECONDS):
        self._ttl = ttl
        self._store: dict[str, tuple[float, object]] = {}  # key → (expires_at, value)
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0

    def get(self, key: str):
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._misses += 1
                return None
            expires_at, value = entry
            if time.monotonic() > expires_at:
                del self._store[key]
                self._misses += 1
                return None
            self._hits += 1
            return value

    def set(self, key: str, value: object, ttl: int | None = None):
        with self._lock:
            expires_at = time.monotonic() + (ttl or self._ttl)
            self._store[key] = (expires_at, value)

    def invalidate(self, key: str):
        with self._lock:
            self._store.pop(key, None)

    def invalidate_all(self):
        with self._lock:
            self._store.clear()

    def stats(self) -> dict:
        with self._lock:
            total = self._hits + self._misses
            return {
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": round(self._hits / total * 100, 1) if total > 0 else 0,
                "cached_entries": len(self._store),
            }


# Module-level cache instance
_trust_cache = TrustCache()


# ─── Scoring functions (copied from backend/app/services/scoring.py) ──
# Pure math functions with zero external dependencies.


def _calculate_uri_stability_score(uri_change_count: int) -> float:
    """URI stability score (0-100). Fewer changes = higher score."""
    if uri_change_count == 0:
        return 100.0
    if uri_change_count <= 2:
        return 80.0
    if uri_change_count <= 5:
        return 50.0
    return max(0.0, 100.0 - uri_change_count * 10)


def _calculate_freshness_multiplier(account_age_days: int) -> float:
    """Freshness penalty: new identities get a score multiplier < 1.0."""
    if account_age_days < 7:
        return 0.70
    if account_age_days < 30:
        return 0.85
    if account_age_days < 90:
        return 0.95
    return 1.0


def calculate_composite_score(
    average_rating: float,
    feedback_count: int,
    rating_std_dev: float,
    validation_success_rate: float,
    account_age_days: int,
    uptime_pct: float = -1.0,
    deployer_score: float = 50.0,
    uri_change_count: int = 0,
) -> tuple[float, ScoreBreakdown]:
    """
    Composite score (0-100) with 8 signals.
    Returns (score, breakdown) so the oracle can expose component scores.
    """
    prior_rating = 50.0
    k = 3
    smoothed_rating = (
        (average_rating * feedback_count + prior_rating * k) / (feedback_count + k)
    )

    rating_score = smoothed_rating

    if feedback_count == 0:
        volume_score = 0.0
    else:
        volume_score = min(
            100.0, (math.log10(feedback_count + 1) / math.log10(101)) * 100
        )

    if feedback_count < 2:
        consistency_score = 50.0
    else:
        max_std = 50.0
        consistency_score = max(0.0, 100.0 * (1 - rating_std_dev / max_std))

    validation_score = validation_success_rate

    if account_age_days <= 0:
        age_score = 0.0
    else:
        age_score = min(
            100.0, (math.log10(account_age_days + 1) / math.log10(366)) * 100
        )

    if uptime_pct < 0:
        uptime_score = 50.0
    else:
        uptime_score = uptime_pct

    uri_stability = _calculate_uri_stability_score(uri_change_count)
    freshness = _calculate_freshness_multiplier(account_age_days)

    composite = (
        rating_score * 0.30
        + volume_score * 0.10
        + consistency_score * 0.10
        + validation_score * 0.15
        + age_score * 0.12
        + uptime_score * 0.10
        + deployer_score * 0.08
        + uri_stability * 0.05
    )

    # Apply freshness penalty
    composite *= freshness

    breakdown = ScoreBreakdown(
        rating_score=round(rating_score, 2),
        volume_score=round(volume_score, 2),
        consistency_score=round(consistency_score, 2),
        validation_score=round(validation_score, 2),
        age_score=round(age_score, 2),
        uptime_score=round(uptime_score, 2),
        deployer_score=round(deployer_score, 2),
        uri_stability_score=round(uri_stability, 2),
    )

    return round(max(0.0, min(100.0, composite)), 2), breakdown


def determine_tier(composite_score: float, feedback_count: int) -> str:
    if composite_score >= 90 and feedback_count >= 50:
        return "diamond"
    elif composite_score >= 80 and feedback_count >= 30:
        return "platinum"
    elif composite_score >= 70 and feedback_count >= 20:
        return "gold"
    elif composite_score >= 60 and feedback_count >= 10:
        return "silver"
    elif composite_score >= 50 and feedback_count >= 5:
        return "bronze"
    else:
        return "unranked"


def calculate_std_dev(ratings: list[int]) -> float:
    if len(ratings) < 2:
        return 0.0
    mean = sum(ratings) / len(ratings)
    variance = sum((r - mean) ** 2 for r in ratings) / len(ratings)
    return math.sqrt(variance)


def calculate_account_age_days(registered_at: datetime) -> int:
    now = datetime.now(timezone.utc)
    if registered_at.tzinfo is None:
        registered_at = registered_at.replace(tzinfo=timezone.utc)
    delta = now - registered_at
    return max(0, delta.days)


# ─── Recommendation & risk logic ──────────────────────────────────────


def _determine_recommendation(
    composite_score: float, feedback_count: int, risk_flags: list[RiskFlag]
) -> Recommendation:
    has_high_risk_flag = any(
        f in risk_flags
        for f in [RiskFlag.HIGH_RISK_SCORE, RiskFlag.CONCENTRATED_FEEDBACK]
    )
    if has_high_risk_flag or composite_score < 50:
        return Recommendation.HIGH_RISK
    if feedback_count < 5:
        return Recommendation.UNVERIFIED
    if composite_score >= 70 and feedback_count >= 10:
        return Recommendation.TRUSTED
    return Recommendation.CAUTION


def _determine_risk_level(risk_flags: list[RiskFlag]) -> RiskLevel:
    if not risk_flags:
        return RiskLevel.LOW
    severity = {
        RiskFlag.HIGH_RISK_SCORE: 3,
        RiskFlag.CONCENTRATED_FEEDBACK: 3,
        RiskFlag.SERIAL_DEPLOYER: 3,
        RiskFlag.SUSPICIOUS_VOLATILITY: 2,
        RiskFlag.LOW_UPTIME: 2,
        RiskFlag.FREQUENT_URI_CHANGES: 2,
        RiskFlag.NEW_IDENTITY: 2,
        RiskFlag.LOW_FEEDBACK: 1,
        RiskFlag.UNVERIFIED: 1,
    }
    max_severity = max(severity.get(f, 1) for f in risk_flags)
    if max_severity >= 3:
        return RiskLevel.HIGH
    if max_severity >= 2:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


# ─── TrustService ─────────────────────────────────────────────────────


class TrustService:
    def evaluate_agent_fast(self, agent_id: int) -> TrustEvaluation:
        """Fast evaluation using pre-computed columns from the agents table.
        Single query instead of 5. Used for cached misses when full recompute
        isn't needed (e.g. data hasn't changed since last screener cycle).
        """
        db = get_supabase()
        result = (
            db.table("agents")
            .select("*")
            .eq("agent_id", agent_id)
            .execute()
        )
        if not result.data:
            raise ValueError(f"Agent #{agent_id} not found")
        agent = result.data[0]

        composite = float(agent.get("composite_score") or 0)
        feedback_count = int(agent.get("total_feedback") or 0)
        tier = agent.get("tier", "unranked")
        avg_rating = float(agent.get("average_rating") or 0)
        success_rate = float(agent.get("validation_success_rate") or 0)

        registered_at = datetime.fromisoformat(
            agent["registered_at"].replace("Z", "+00:00")
        )
        age_days = calculate_account_age_days(registered_at)

        # Minimal risk flags from pre-computed data
        risk_flags: list[RiskFlag] = []
        if composite < 50:
            risk_flags.append(RiskFlag.HIGH_RISK_SCORE)
        if feedback_count < 5:
            risk_flags.append(RiskFlag.LOW_FEEDBACK)
        if feedback_count == 0:
            risk_flags.append(RiskFlag.UNVERIFIED)
        if age_days < 7:
            risk_flags.append(RiskFlag.NEW_IDENTITY)

        recommendation = _determine_recommendation(composite, feedback_count, risk_flags)

        # Reconstruct a minimal breakdown (scores not available from pre-computed)
        breakdown = ScoreBreakdown(
            rating_score=round(avg_rating, 2),
            volume_score=0,
            consistency_score=0,
            validation_score=round(success_rate, 2),
            age_score=0,
            uptime_score=0,
            deployer_score=0,
            uri_stability_score=0,
        )

        evaluation = TrustEvaluation(
            agent_id=agent_id,
            name=agent.get("name"),
            composite_score=composite,
            tier=tier,
            recommendation=recommendation,
            risk_flags=risk_flags,
            score_breakdown=breakdown,
            feedback_count=feedback_count,
            average_rating=round(avg_rating, 2),
            validation_success_rate=round(success_rate, 2),
            account_age_days=age_days,
            uptime_pct=-1.0,
            evaluated_at=datetime.now(timezone.utc),
        )

        # Cache it
        _trust_cache.set(f"eval:{agent_id}", evaluation)
        return evaluation

    def evaluate_agent(self, agent_id: int, bypass_cache: bool = False) -> TrustEvaluation:
        # Check cache first
        if not bypass_cache:
            cached = _trust_cache.get(f"eval:{agent_id}")
            if cached is not None:
                return cached

        db = get_supabase()

        # Fetch agent
        result = (
            db.table("agents").select("*").eq("agent_id", agent_id).execute()
        )
        if not result.data:
            raise ValueError(f"Agent #{agent_id} not found")
        agent = result.data[0]

        # Fetch ratings
        ratings_result = (
            db.table("reputation_events")
            .select("rating, reviewer_address")
            .eq("agent_id", agent_id)
            .execute()
        )
        ratings = [r["rating"] for r in ratings_result.data]
        reviewer_addresses = [r["reviewer_address"] for r in ratings_result.data]
        feedback_count = len(ratings)
        avg_rating = sum(ratings) / len(ratings) if ratings else 0
        std_dev = calculate_std_dev(ratings)

        # Validation success rate
        try:
            validations = (
                db.table("validation_records")
                .select("is_valid")
                .eq("agent_id", agent_id)
                .not_.is_("is_valid", "null")
                .execute()
            )
            completed = len(validations.data)
            successful = sum(1 for v in validations.data if v["is_valid"])
            success_rate = (successful / completed * 100) if completed > 0 else 0
        except Exception:
            success_rate = 0

        # Account age
        registered_at = datetime.fromisoformat(
            agent["registered_at"].replace("Z", "+00:00")
        )
        age_days = calculate_account_age_days(registered_at)

        # Uptime (last 30 days)
        uptime_pct = -1.0
        try:
            uptime_result = (
                db.table("uptime_daily_summary")
                .select("uptime_pct")
                .eq("agent_id", agent_id)
                .order("summary_date", desc=True)
                .limit(30)
                .execute()
            )
            if uptime_result.data:
                uptime_pct = sum(r["uptime_pct"] for r in uptime_result.data) / len(
                    uptime_result.data
                )
        except Exception:
            pass

        # Deployer reputation lookup
        dep_score = 50.0
        try:
            dep_result = (
                db.table("deployer_reputation")
                .select("deployer_score")
                .eq("owner_address", agent.get("owner_address", ""))
                .limit(1)
                .execute()
            )
            if dep_result.data:
                dep_score = float(dep_result.data[0].get("deployer_score", 50))
        except Exception:
            pass

        # URI change count
        uri_changes = int(agent.get("uri_change_count", 0) or 0)

        # Compute score
        composite, breakdown = calculate_composite_score(
            average_rating=avg_rating,
            feedback_count=feedback_count,
            rating_std_dev=std_dev,
            validation_success_rate=success_rate,
            account_age_days=age_days,
            uptime_pct=uptime_pct,
            deployer_score=dep_score,
            uri_change_count=uri_changes,
        )
        tier = determine_tier(composite, feedback_count)

        # Risk flags
        risk_flags: list[RiskFlag] = []
        if composite < 50:
            risk_flags.append(RiskFlag.HIGH_RISK_SCORE)
        if feedback_count < 5:
            risk_flags.append(RiskFlag.LOW_FEEDBACK)
        if feedback_count == 0:
            risk_flags.append(RiskFlag.UNVERIFIED)
        if 0 <= uptime_pct < 80:
            risk_flags.append(RiskFlag.LOW_UPTIME)
        # Concentrated feedback check
        if reviewer_addresses and feedback_count >= 3:
            counts = Counter(reviewer_addresses)
            top_count = counts.most_common(1)[0][1]
            if top_count / feedback_count > 0.6:
                risk_flags.append(RiskFlag.CONCENTRATED_FEEDBACK)
        # New anti-mutation flags
        if dep_score < 30:
            risk_flags.append(RiskFlag.SERIAL_DEPLOYER)
        if uri_changes >= 3:
            risk_flags.append(RiskFlag.FREQUENT_URI_CHANGES)
        if age_days < 7:
            risk_flags.append(RiskFlag.NEW_IDENTITY)

        recommendation = _determine_recommendation(
            composite, feedback_count, risk_flags
        )

        evaluation = TrustEvaluation(
            agent_id=agent_id,
            name=agent.get("name"),
            composite_score=composite,
            tier=tier,
            recommendation=recommendation,
            risk_flags=risk_flags,
            score_breakdown=breakdown,
            feedback_count=feedback_count,
            average_rating=round(avg_rating, 2),
            validation_success_rate=round(success_rate, 2),
            account_age_days=age_days,
            uptime_pct=round(uptime_pct, 2),
            evaluated_at=datetime.now(timezone.utc),
        )

        # Populate cache
        _trust_cache.set(f"eval:{agent_id}", evaluation)
        return evaluation

    def find_trusted_agents(
        self,
        category: str | None = None,
        min_score: float = 0,
        min_feedback: int = 0,
        tier: str | None = None,
        limit: int = 20,
    ) -> list[TrustedAgent]:
        db = get_supabase()
        query = db.table("agents").select(
            "agent_id, name, composite_score, tier, category, total_feedback"
        )

        if category:
            query = query.eq("category", category)
        if tier:
            query = query.eq("tier", tier)
        if min_score > 0:
            query = query.gte("composite_score", min_score)
        if min_feedback > 0:
            query = query.gte("total_feedback", min_feedback)

        query = query.order("composite_score", desc=True).limit(min(limit, 100))
        result = query.execute()

        return [
            TrustedAgent(
                agent_id=a["agent_id"],
                name=a.get("name"),
                composite_score=float(a.get("composite_score") or 0),
                tier=a.get("tier", "unranked"),
                category=a.get("category"),
                feedback_count=a.get("total_feedback", 0),
            )
            for a in result.data
        ]

    def risk_check(self, agent_id: int) -> RiskAssessment:
        evaluation = self.evaluate_agent(agent_id)
        risk_flags = list(evaluation.risk_flags)

        # Additional: score volatility from score_history
        db = get_supabase()
        try:
            history = (
                db.table("score_history")
                .select("composite_score")
                .eq("agent_id", agent_id)
                .order("snapshot_date", desc=True)
                .limit(14)
                .execute()
            )
            if len(history.data) >= 3:
                scores = [float(h["composite_score"]) for h in history.data]
                score_range = max(scores) - min(scores)
                if score_range > 30:
                    risk_flags.append(RiskFlag.SUSPICIOUS_VOLATILITY)
        except Exception:
            pass

        # Deduplicate
        risk_flags = list(set(risk_flags))

        risk_level = _determine_risk_level(risk_flags)
        recommendation = _determine_recommendation(
            evaluation.composite_score, evaluation.feedback_count, risk_flags
        )

        details_parts = []
        if RiskFlag.HIGH_RISK_SCORE in risk_flags:
            details_parts.append(
                f"Composite score {evaluation.composite_score} is below 50"
            )
        if RiskFlag.CONCENTRATED_FEEDBACK in risk_flags:
            details_parts.append(
                "Over 60% of feedback comes from a single reviewer"
            )
        if RiskFlag.SUSPICIOUS_VOLATILITY in risk_flags:
            details_parts.append("Score has varied by more than 30 points recently")
        if RiskFlag.LOW_UPTIME in risk_flags:
            details_parts.append(
                f"Uptime is {evaluation.uptime_pct}%, below 80% threshold"
            )
        if RiskFlag.LOW_FEEDBACK in risk_flags:
            details_parts.append(
                f"Only {evaluation.feedback_count} feedback entries"
            )
        if RiskFlag.UNVERIFIED in risk_flags:
            details_parts.append("Agent has no feedback history")
        if RiskFlag.SERIAL_DEPLOYER in risk_flags:
            details_parts.append(
                "Deployer has a low reputation score — high agent abandonment rate"
            )
        if RiskFlag.FREQUENT_URI_CHANGES in risk_flags:
            details_parts.append(
                "Agent URI has been changed 3+ times — possible identity mutation"
            )
        if RiskFlag.NEW_IDENTITY in risk_flags:
            details_parts.append(
                "Agent identity is less than 7 days old — freshness penalty applied"
            )

        return RiskAssessment(
            agent_id=agent_id,
            recommendation=recommendation,
            risk_flags=risk_flags,
            risk_level=risk_level,
            details=". ".join(details_parts) if details_parts else "No risk flags detected",
        )

    def network_stats(self, bypass_cache: bool = False) -> NetworkStats:
        if not bypass_cache:
            cached = _trust_cache.get("network_stats")
            if cached is not None:
                return cached

        db = get_supabase()

        # Total agents via exact count (avoids Supabase default 1000-row limit)
        count_result = (
            db.table("agents")
            .select("agent_id", count="exact")
            .limit(0)
            .execute()
        )
        total_agents = count_result.count or 0

        # Paginate all agents for avg score + tier distribution
        # Supabase default limit is 1000, so we fetch in pages
        all_scores: list[float] = []
        tier_dist: dict[str, int] = {}
        page_size = 1000
        offset = 0
        while True:
            batch = (
                db.table("agents")
                .select("composite_score, tier")
                .range(offset, offset + page_size - 1)
                .execute()
            )
            if not batch.data:
                break
            for a in batch.data:
                score = float(a.get("composite_score") or 0)
                all_scores.append(score)
                t = a.get("tier", "unranked")
                tier_dist[t] = tier_dist.get(t, 0) + 1
            if len(batch.data) < page_size:
                break
            offset += page_size

        avg_score = 0.0
        if all_scores:
            avg_score = round(sum(all_scores) / len(all_scores), 2)

        # Total feedback
        try:
            fb_result = db.table("reputation_events").select("id", count="exact").execute()
            total_feedback = fb_result.count or 0
        except Exception:
            total_feedback = 0

        # Total screenings (oracle_screenings — no ValidationRegistry deployed)
        try:
            val_result = (
                db.table("oracle_screenings").select("id", count="exact").execute()
            )
            total_validations = val_result.count or 0
        except Exception:
            total_validations = 0

        # Liveness attestations (on-chain feedback with tag1="liveness")
        try:
            liveness_result = (
                db.table("reputation_events")
                .select("id", count="exact")
                .eq("tag1", "liveness")
                .execute()
            )
            total_liveness = liveness_result.count or 0
        except Exception:
            total_liveness = 0

        stats = NetworkStats(
            total_agents=total_agents,
            avg_score=avg_score,
            tier_distribution=tier_dist,
            total_feedback=total_feedback,
            total_validations=total_validations,
            total_liveness=total_liveness,
        )

        _trust_cache.set("network_stats", stats)
        return stats


# Singleton
_trust_service: TrustService | None = None


def get_trust_service() -> TrustService:
    global _trust_service
    if _trust_service is None:
        _trust_service = TrustService()
    return _trust_service


def get_trust_cache() -> TrustCache:
    """Access the module-level trust cache (for REST headers, stats, warming)."""
    return _trust_cache
