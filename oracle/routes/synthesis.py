"""
Synthesis Hackathon leaderboard — /api/v1/synthesis/*

Tracks score velocity (delta over the build period) rather than absolute score.
Since all hackathon agents start from scratch, absolute scores cluster together.
Velocity captures who is building the fastest, most reputable agent.

Signals weighted for hackathon context (fast-moving signals emphasized):
- Score velocity (delta from first to latest score)
- Activity volume (transactions, feedback received)
- Liveness (uptime during the event)
- Task completion (validation success rate)
- Peer feedback (ratings from other hackathon builders)

Time-dependent signals (account age, long-term consistency) are de-weighted.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query

from database import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/synthesis", tags=["synthesis"])


def _safe_float(val, default=0.0) -> float:
    try:
        return float(val) if val is not None else default
    except (ValueError, TypeError):
        return default


def _safe_int(val, default=0) -> int:
    try:
        return int(val) if val is not None else default
    except (ValueError, TypeError):
        return default


@router.get("/leaderboard")
async def synthesis_leaderboard(
    sort_by: str = Query("velocity", description="Sort by: velocity, score, activity, liveness"),
    limit: int = Query(50, ge=1, le=200),
):
    """Synthesis hackathon leaderboard — ranked by score velocity.

    Returns all agents registered via Synthesis hackathon keys,
    ranked by how fast they're building reputation.
    """
    db = get_supabase()

    try:
        # Find all agents registered by synthesis-tier API keys
        # These agents were registered using keys with metadata.event = "synthesis-hackathon"
        # We identify them by matching api_keys with tier='synthesis' and linking via owner_address
        # Alternatively, look for agents registered after synthesis keys were created
        #
        # Simplest approach: query agents that have metadata or were registered
        # during the hackathon window. For now, get all agents and compute velocity.
        #
        # Better approach: tag agents at registration with synthesis metadata.
        # For MVP, we'll identify synthesis agents by checking api_keys table
        # and matching protocol_name patterns, or by a synthesis_agents tracking table.
        #
        # Pragmatic approach: use a time window + any agent that was evaluated
        # by a synthesis-tier key. For the hackathon, we'll track all agents
        # that received their first evaluation within the hackathon window.

        # Get synthesis key registrations to find the hackathon start window
        synth_keys = (
            db.table("api_keys")
            .select("id, protocol_name, metadata, created_at")
            .eq("tier", "synthesis")
            .eq("is_active", True)
            .execute()
        )

        if not synth_keys.data:
            return {
                "leaderboard": [],
                "hackathon_stats": {
                    "total_teams": 0,
                    "total_agents_scored": 0,
                    "avg_velocity": 0.0,
                    "hackathon_active": False,
                },
            }

        # Find the earliest synthesis key to determine hackathon start
        key_dates = []
        team_names = set()
        for k in synth_keys.data:
            team_names.add(k.get("protocol_name", "unknown"))
            if k.get("created_at"):
                try:
                    dt = datetime.fromisoformat(k["created_at"].replace("Z", "+00:00"))
                    key_dates.append(dt)
                except (ValueError, TypeError):
                    pass

        hackathon_start = min(key_dates) if key_dates else datetime.now(timezone.utc) - timedelta(days=30)

        # Get all agents with score history since hackathon start
        start_str = hackathon_start.strftime("%Y-%m-%d")

        # Get score history snapshots for velocity calculation
        history_result = (
            db.table("score_history")
            .select("agent_id, composite_score, total_feedback, validation_success_rate, snapshot_date")
            .gte("snapshot_date", start_str)
            .order("snapshot_date", desc=False)
            .execute()
        )

        # Build per-agent history
        agent_history: dict[int, list[dict]] = {}
        for row in (history_result.data or []):
            aid = row["agent_id"]
            if aid not in agent_history:
                agent_history[aid] = []
            agent_history[aid].append(row)

        # Get current agent data
        agents_result = (
            db.table("agents")
            .select(
                "agent_id, name, category, source_chain, composite_score, "
                "average_rating, total_feedback, validation_success_rate, "
                "tier, registered_at"
            )
            .gte("registered_at", hackathon_start.isoformat())
            .order("composite_score", desc=True)
            .limit(500)
            .execute()
        )

        if not agents_result.data:
            # Fallback: get any agents with score history in the window
            agent_ids = list(agent_history.keys())[:200]
            if agent_ids:
                agents_result = (
                    db.table("agents")
                    .select(
                        "agent_id, name, category, source_chain, composite_score, "
                        "average_rating, total_feedback, validation_success_rate, "
                        "tier, registered_at"
                    )
                    .in_("agent_id", agent_ids)
                    .order("composite_score", desc=True)
                    .execute()
                )

        # Get uptime data for liveness scoring
        uptime_result = (
            db.table("uptime_daily_summary")
            .select("agent_id, uptime_pct, successful_checks")
            .gte("summary_date", start_str)
            .execute()
        )

        # Aggregate uptime per agent
        agent_uptime: dict[int, list[float]] = {}
        for row in (uptime_result.data or []):
            aid = row["agent_id"]
            if aid not in agent_uptime:
                agent_uptime[aid] = []
            pct = _safe_float(row.get("uptime_pct"))
            agent_uptime[aid].append(pct)

        # Get feedback counts during hackathon window
        feedback_result = (
            db.table("reputation_events")
            .select("agent_id")
            .gte("created_at", hackathon_start.isoformat())
            .execute()
        )

        # Count feedback per agent during hackathon
        hackathon_feedback: dict[int, int] = {}
        for row in (feedback_result.data or []):
            aid = row["agent_id"]
            hackathon_feedback[aid] = hackathon_feedback.get(aid, 0) + 1

        # Compute velocity and build leaderboard entries
        entries = []
        for agent in (agents_result.data or []):
            aid = agent["agent_id"]
            current_score = _safe_float(agent.get("composite_score"))
            history = agent_history.get(aid, [])

            # Score velocity: delta from first snapshot to current
            first_score = _safe_float(history[0].get("composite_score")) if history else 0.0
            score_velocity = current_score - first_score

            # Activity: feedback received during hackathon
            activity_count = hackathon_feedback.get(aid, 0)

            # Liveness: average uptime during hackathon
            uptimes = agent_uptime.get(aid, [])
            avg_uptime = sum(uptimes) / len(uptimes) if uptimes else 0.0

            # Days active (from registration to now)
            days_active = 0
            reg = agent.get("registered_at")
            if reg:
                try:
                    reg_dt = datetime.fromisoformat(str(reg).replace("Z", "+00:00"))
                    days_active = max(1, (datetime.now(timezone.utc) - reg_dt).days)
                except (ValueError, TypeError):
                    days_active = 1

            # Velocity per day (normalized)
            velocity_per_day = score_velocity / max(days_active, 1)

            # Composite hackathon score (weighted for fast-moving signals)
            # 35% score velocity, 25% activity, 20% liveness, 20% current score
            hackathon_score = (
                (min(score_velocity, 100) / 100 * 35) +           # velocity (0-35)
                (min(activity_count, 50) / 50 * 25) +              # activity (0-25)
                (avg_uptime / 100 * 20) +                           # liveness (0-20)
                (current_score / 100 * 20)                          # current score (0-20)
            )

            entries.append({
                "rank": 0,  # set after sorting
                "agent_id": aid,
                "name": agent.get("name") or f"Agent #{aid}",
                "category": agent.get("category"),
                "source_chain": agent.get("source_chain"),
                "current_score": round(current_score, 2),
                "first_score": round(first_score, 2),
                "score_velocity": round(score_velocity, 2),
                "velocity_per_day": round(velocity_per_day, 2),
                "hackathon_score": round(hackathon_score, 2),
                "activity_count": activity_count,
                "avg_uptime": round(avg_uptime, 1),
                "tier": agent.get("tier", "unranked"),
                "days_active": days_active,
                "total_feedback": _safe_int(agent.get("total_feedback")),
                "validation_success_rate": round(_safe_float(agent.get("validation_success_rate")), 1),
            })

        # Sort by selected metric
        sort_keys = {
            "velocity": lambda e: e["score_velocity"],
            "score": lambda e: e["hackathon_score"],
            "activity": lambda e: e["activity_count"],
            "liveness": lambda e: e["avg_uptime"],
        }
        sort_fn = sort_keys.get(sort_by, sort_keys["velocity"])
        entries.sort(key=sort_fn, reverse=True)

        # Assign ranks and trim
        for i, entry in enumerate(entries[:limit]):
            entry["rank"] = i + 1
        entries = entries[:limit]

        # Hackathon-wide stats
        total_velocity = sum(e["score_velocity"] for e in entries)
        avg_velocity = total_velocity / len(entries) if entries else 0.0

        return {
            "leaderboard": entries,
            "hackathon_stats": {
                "total_teams": len(team_names),
                "total_agents_scored": len(entries),
                "avg_velocity": round(avg_velocity, 2),
                "top_velocity": round(entries[0]["score_velocity"], 2) if entries else 0.0,
                "hackathon_start": hackathon_start.isoformat(),
                "hackathon_active": True,
            },
            "scoring_weights": {
                "score_velocity": "35%",
                "activity_volume": "25%",
                "liveness": "20%",
                "current_score": "20%",
                "note": "Time-dependent signals (account age, consistency) are de-weighted for hackathon context.",
            },
        }

    except Exception as e:
        logger.error(f"Synthesis leaderboard error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/agent/{agent_id}")
async def synthesis_agent_detail(agent_id: int):
    """Detailed hackathon progress for a single agent.

    Shows score trajectory, activity timeline, and signal breakdown
    during the hackathon window.
    """
    db = get_supabase()

    try:
        # Get agent info
        agent_result = (
            db.table("agents")
            .select(
                "agent_id, name, category, source_chain, composite_score, "
                "average_rating, total_feedback, validation_success_rate, "
                "tier, registered_at"
            )
            .eq("agent_id", agent_id)
            .limit(1)
            .execute()
        )

        if not agent_result.data:
            raise HTTPException(status_code=404, detail=f"Agent #{agent_id} not found")

        agent = agent_result.data[0]

        # Score trajectory (all snapshots)
        history_result = (
            db.table("score_history")
            .select("composite_score, average_rating, total_feedback, validation_success_rate, snapshot_date")
            .eq("agent_id", agent_id)
            .order("snapshot_date", desc=False)
            .execute()
        )
        history = history_result.data or []

        # Uptime history
        uptime_result = (
            db.table("uptime_daily_summary")
            .select("summary_date, uptime_pct, avg_latency_ms, successful_checks, total_checks")
            .eq("agent_id", agent_id)
            .order("summary_date", desc=False)
            .execute()
        )

        # Recent feedback
        feedback_result = (
            db.table("reputation_events")
            .select("rating, tag1, reviewer_address, created_at")
            .eq("agent_id", agent_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )

        # Compute velocity
        current_score = _safe_float(agent.get("composite_score"))
        first_score = _safe_float(history[0].get("composite_score")) if history else 0.0
        score_velocity = current_score - first_score

        # Peak score
        peak_score = max((_safe_float(h.get("composite_score")) for h in history), default=current_score)

        return {
            "agent_id": agent_id,
            "name": agent.get("name") or f"Agent #{agent_id}",
            "category": agent.get("category"),
            "source_chain": agent.get("source_chain"),
            "tier": agent.get("tier", "unranked"),
            "registered_at": agent.get("registered_at"),
            "velocity": {
                "current_score": round(current_score, 2),
                "first_score": round(first_score, 2),
                "score_velocity": round(score_velocity, 2),
                "peak_score": round(peak_score, 2),
                "snapshots": len(history),
            },
            "score_trajectory": [
                {
                    "date": h["snapshot_date"],
                    "score": round(_safe_float(h.get("composite_score")), 2),
                    "feedback_count": _safe_int(h.get("total_feedback")),
                }
                for h in history
            ],
            "uptime_history": uptime_result.data or [],
            "recent_feedback": feedback_result.data or [],
            "current_stats": {
                "composite_score": round(current_score, 2),
                "average_rating": round(_safe_float(agent.get("average_rating")), 2),
                "total_feedback": _safe_int(agent.get("total_feedback")),
                "validation_success_rate": round(_safe_float(agent.get("validation_success_rate")), 1),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Synthesis agent detail error for #{agent_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/stats")
async def synthesis_stats():
    """Aggregate hackathon statistics — live dashboard data."""
    db = get_supabase()

    try:
        # Count synthesis keys
        keys_result = (
            db.table("api_keys")
            .select("id, protocol_name, created_at")
            .eq("tier", "synthesis")
            .eq("is_active", True)
            .execute()
        )
        keys = keys_result.data or []
        team_names = list({k.get("protocol_name", "unknown") for k in keys})

        # Count total API calls from synthesis keys
        key_ids = [k["id"] for k in keys]

        total_api_calls = 0
        if key_ids:
            usage_result = (
                db.table("api_usage_daily")
                .select("request_count")
                .in_("api_key_id", key_ids)
                .execute()
            )
            total_api_calls = sum(
                _safe_int(r.get("request_count")) for r in (usage_result.data or [])
            )

        # Get agents registered during hackathon window
        if keys:
            earliest = min(
                (k["created_at"] for k in keys if k.get("created_at")),
                default=None,
            )
        else:
            earliest = None

        agents_scored = 0
        avg_score = 0.0
        tier_dist: dict[str, int] = {}

        if earliest:
            agents_result = (
                db.table("agents")
                .select("composite_score, tier")
                .gte("registered_at", earliest)
                .execute()
            )
            agents = agents_result.data or []
            agents_scored = len(agents)
            if agents:
                scores = [_safe_float(a.get("composite_score")) for a in agents]
                avg_score = sum(scores) / len(scores)
                for a in agents:
                    t = a.get("tier", "unranked")
                    tier_dist[t] = tier_dist.get(t, 0) + 1

        return {
            "hackathon": {
                "name": "The Synthesis",
                "active": True,
                "total_teams": len(team_names),
                "teams": team_names,
                "total_api_calls": total_api_calls,
                "agents_scored": agents_scored,
                "avg_score": round(avg_score, 2),
                "tier_distribution": tier_dist,
            },
        }

    except Exception as e:
        logger.error(f"Synthesis stats error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
