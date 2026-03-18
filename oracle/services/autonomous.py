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
from services.trust import get_trust_cache
from services.feed import get_feed_bus, TrustEvent
from services.webhooks import deliver_event

logger = logging.getLogger(__name__)

SCREEN_BATCH_SIZE = 200
ONCHAIN_FEEDBACK_LIMIT_PER_CYCLE = 20

# Map risk_level → on-chain score (1-100)
RISK_LEVEL_SCORES = {
    "low": 85,
    "medium": 60,
    "high": 30,
    "critical": 10,
}
LIVENESS_BATCH_SIZE = 20
LIVENESS_TIMEOUT = 10
RESCREEN_STALE_DAYS = 3
RESCREEN_BATCH_SIZE = 50


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
            "sync_github_activity": 0,
            "sync_delegation_events": 0,
            "compute_failure_metrics": 0,
            "crawl_capabilities": 0,
        }
        self.last_errors: dict[str, str] = {}

    async def start(self):
        """Launch all background jobs as asyncio tasks."""
        self._running = True
        # Store reference to the main event loop for safe cross-thread publishing
        self._main_loop = asyncio.get_running_loop()
        logger.info("AgentScreener starting — 8 background jobs")
        self._tasks = [
            asyncio.create_task(self._loop("screen_new_agents", self._screen_new_agents, 300)),
            asyncio.create_task(self._loop("monitor_anomalies", self._monitor_anomalies, 900)),
            asyncio.create_task(self._loop("verify_agent_liveness", self._verify_agent_liveness, 3600)),
            asyncio.create_task(self._loop("publish_network_report", self._publish_network_report, 21600)),
            asyncio.create_task(self._loop("sync_github_activity", self._sync_github_activity, 600)),
            asyncio.create_task(self._loop("sync_delegation_events", self._sync_delegation_events, 600)),
            asyncio.create_task(self._loop("compute_failure_metrics", self._compute_failure_metrics, 1800)),
            asyncio.create_task(self._loop("sync_job_outcomes", self._sync_job_outcomes, 600)),
            asyncio.create_task(self._loop("crawl_capabilities", self._crawl_capabilities, 1800)),
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
        from services.agent_logger import get_agent_logger

        # Stagger initial starts so jobs don't all hit Supabase simultaneously
        delays = {
            "screen_new_agents": 10,
            "monitor_anomalies": 30,
            "verify_agent_liveness": 60,
            "publish_network_report": 120,
            "sync_github_activity": 150,
            "sync_delegation_events": 180,
            "compute_failure_metrics": 240,
            "sync_job_outcomes": 270,
            "crawl_capabilities": 300,
        }
        await asyncio.sleep(delays.get(name, 5))

        while self._running:
            try:
                await asyncio.to_thread(func)
                self.last_runs[name] = datetime.now(timezone.utc)
                self.job_counts[name] += 1
                self.last_errors.pop(name, None)
                # Log successful execution
                try:
                    get_agent_logger().log(
                        action=name,
                        description=f"Autonomous job '{name}' completed (run #{self.job_counts[name]})",
                        outcome="success",
                        tool_calls=["supabase_query", "scoring_engine"],
                    )
                except Exception:
                    pass
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[{name}] Error: {e}", exc_info=True)
                self.last_errors[name] = str(e)
                # Log failure
                try:
                    get_agent_logger().log(
                        action=name,
                        description=f"Autonomous job '{name}' failed: {e}",
                        outcome="failure",
                        details={"error": str(e)},
                    )
                except Exception:
                    pass
            await asyncio.sleep(interval_seconds)

    # ─── Risk Evaluation Helper ───────────────────────────────────────

    def _evaluate_agent_risk(self, db, agent: dict) -> dict:
        """Evaluate a single agent's risk level and flags. Returns a screening row dict."""
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

        return {
            "agent_id": agent_id,
            "risk_level": risk_level,
            "flags": flags,
            "screened_at": datetime.now(timezone.utc).isoformat(),
        }

    def _insert_screenings_and_submit(self, db, screening_rows: list[dict], label: str):
        """Insert screening rows to Supabase, update oracle_last_screened, submit on-chain."""
        if not screening_rows:
            return

        now = screening_rows[0]["screened_at"]

        # Batch insert screenings
        try:
            db.table("oracle_screenings").insert(screening_rows).execute()
        except Exception as e:
            logger.error(f"[{label}] Failed to insert screenings: {e}")
            return

        # Mark each agent as screened
        for r in screening_rows:
            try:
                db.table("agents").update(
                    {"oracle_last_screened": now}
                ).eq("agent_id", r["agent_id"]).execute()
            except Exception as e:
                logger.error(
                    f"[{label}] Failed to update oracle_last_screened "
                    f"for agent {r['agent_id']}: {e}"
                )

        logger.info(f"[{label}] Screened {len(screening_rows)} agents")

        # Log screening decision
        try:
            from services.agent_logger import get_agent_logger
            risk_counts = Counter(r["risk_level"] for r in screening_rows)
            get_agent_logger().log(
                action="screening_batch",
                description=f"Screened {len(screening_rows)} agents — {dict(risk_counts)}",
                outcome="success",
                tool_calls=["supabase_query", "risk_evaluation"],
                details={
                    "batch_label": label,
                    "count": len(screening_rows),
                    "risk_distribution": dict(risk_counts),
                },
            )
        except Exception:
            pass

        # Submit on-chain feedback (max per cycle)
        chain = get_chain_service()
        if chain is not None:
            submitted = 0
            failed = 0
            failed_agents: list[int] = []
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
                            f"[{label}] On-chain feedback for agent {agent_id}: "
                            f"score={score} tx={tx_hash}"
                        )
                    else:
                        failed += 1
                        failed_agents.append(agent_id)
                except Exception as e:
                    failed += 1
                    failed_agents.append(agent_id)
                    logger.error(
                        f"[{label}] On-chain feedback failed for agent {agent_id}: {e}"
                    )
                    continue

            if submitted > 0:
                logger.info(f"[{label}] Submitted {submitted} on-chain feedbacks")
                try:
                    from services.agent_logger import get_agent_logger
                    get_agent_logger().log(
                        action="onchain_feedback",
                        description=f"Submitted {submitted} on-chain feedback transactions",
                        outcome="success",
                        tool_calls=["erc8004_reputation_registry", "eth_sendTransaction"],
                        details={"submitted": submitted, "failed": failed},
                    )
                except Exception:
                    pass
            if failed > 0:
                logger.warning(
                    f"[{label}] Failed {failed} on-chain submissions "
                    f"(agents: {failed_agents[:10]})"
                )
                # Record failures for retry on next cycle
                try:
                    db.table("oracle_submission_failures").insert([
                        {"agent_id": aid, "label": label, "failed_at": now}
                        for aid in failed_agents
                    ]).execute()
                except Exception:
                    pass  # Table may not exist yet — failures still logged above

        # Invalidate cache for screened agents so next request gets fresh data
        cache = get_trust_cache()
        for r in screening_rows:
            cache.invalidate(f"eval:{r['agent_id']}")
        cache.invalidate("network_stats")
        cache.sweep()  # Periodic cleanup of expired entries

        # Publish to SSE feed
        self._publish_feed_events(db, screening_rows)

    def _publish_feed_events(self, db, screening_rows: list[dict]):
        """Publish screening results to the SSE feed bus."""
        import asyncio

        bus = get_feed_bus()
        for row in screening_rows:
            agent_id = row["agent_id"]
            # Look up agent name and previous score for delta
            try:
                agent_data = (
                    db.table("agents")
                    .select("name, composite_score")
                    .eq("agent_id", agent_id)
                    .limit(1)
                    .execute()
                )
                name = agent_data.data[0].get("name") if agent_data.data else None
                current_score = float(agent_data.data[0].get("composite_score", 0) or 0) if agent_data.data else 0
            except Exception:
                name = None
                current_score = 0

            event = TrustEvent(
                event_id=0,  # assigned by bus
                agent_id=agent_id,
                agent_name=name,
                score=current_score,
                tier="",
                risk_level=row["risk_level"],
                delta=0,
                alert_type="screening",
                timestamp=0,
            )

            try:
                # Use the main event loop stored at startup (safe from worker threads)
                main_loop = getattr(self, "_main_loop", None)
                if main_loop is not None and main_loop.is_running():
                    asyncio.run_coroutine_threadsafe(bus.publish(event), main_loop)
                else:
                    # Fallback: try to find a running loop
                    try:
                        loop = asyncio.get_running_loop()
                        loop.create_task(bus.publish(event))
                    except RuntimeError:
                        pass  # No loop available in this thread
            except Exception:
                pass

    # ─── Job 1: Screen New Agents (every 5 min) ──────────────────────

    def _screen_new_agents(self):
        """Screen agents that haven't been evaluated by the oracle yet.

        Prioritises Avalanche agents (agent_id <= 1621) first, then backfills
        with Ethereum agents (agent_id > 1621) up to SCREEN_BATCH_SIZE.
        Also re-screens agents whose last screening is older than RESCREEN_STALE_DAYS.
        """
        db = get_supabase()

        # ── Phase 1: New (unscreened) agents ──────────────────────────
        avax_result = (
            db.table("agents")
            .select("agent_id, owner_address, registered_at, composite_score, total_feedback, tier")
            .is_("oracle_last_screened", "null")
            .lte("agent_id", 1621)
            .limit(SCREEN_BATCH_SIZE)
            .execute()
        )
        agents = avax_result.data or []

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

        if agents:
            logger.info(f"[screen_new_agents] Screening {len(agents)} unscreened agents")
            screening_rows = [self._evaluate_agent_risk(db, a) for a in agents]
            self._insert_screenings_and_submit(db, screening_rows, "screen_new_agents")

        # ── Phase 2: Re-screen stale agents (screened > N days ago) ───
        stale_cutoff = (datetime.now(timezone.utc) - timedelta(days=RESCREEN_STALE_DAYS)).isoformat()
        try:
            stale_result = (
                db.table("agents")
                .select("agent_id, owner_address, registered_at, composite_score, total_feedback, tier")
                .lt("oracle_last_screened", stale_cutoff)
                .order("oracle_last_screened")
                .limit(RESCREEN_BATCH_SIZE)
                .execute()
            )
            stale_agents = stale_result.data or []
        except Exception as e:
            logger.warning(f"[screen_new_agents] Stale re-screen query failed: {e}")
            stale_agents = []

        if stale_agents:
            logger.info(f"[screen_new_agents] Re-screening {len(stale_agents)} stale agents")
            rescreen_rows = [self._evaluate_agent_risk(db, a) for a in stale_agents]

            # Detect risk level changes and create alerts
            for row in rescreen_rows:
                try:
                    prev = (
                        db.table("oracle_screenings")
                        .select("risk_level")
                        .eq("agent_id", row["agent_id"])
                        .order("screened_at", desc=True)
                        .limit(1)
                        .execute()
                    )
                    if prev.data and prev.data[0]["risk_level"] != row["risk_level"]:
                        old_risk = prev.data[0]["risk_level"]
                        new_risk = row["risk_level"]
                        details = f"Risk changed from {old_risk} to {new_risk} on re-screening"
                        db.table("oracle_alerts").insert({
                            "agent_id": row["agent_id"],
                            "alert_type": "risk_level_change",
                            "severity": "medium",
                            "details": details,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        }).execute()

                        # Dispatch webhook
                        try:
                            deliver_event("risk_change", row["agent_id"], {
                                "old_risk": old_risk,
                                "new_risk": new_risk,
                                "flags": row["flags"],
                                "details": details,
                            })
                        except Exception:
                            pass
                except Exception:
                    pass

            # Detect score and tier changes for protocol integration webhooks
            for agent in stale_agents:
                agent_id = agent["agent_id"]
                old_score = float(agent.get("composite_score") or 0)
                old_tier = agent.get("tier", "unranked")
                try:
                    # Fetch current score from agents table (may have been updated by scoring cycle)
                    current = (
                        db.table("agents")
                        .select("composite_score, tier")
                        .eq("agent_id", agent_id)
                        .limit(1)
                        .execute()
                    )
                    if not current.data:
                        continue
                    new_score = float(current.data[0].get("composite_score") or 0)
                    new_tier = current.data[0].get("tier", "unranked")
                    delta = new_score - old_score

                    if abs(delta) >= 1.0:
                        try:
                            deliver_event("score_change", agent_id, {
                                "old_score": round(old_score, 2),
                                "new_score": round(new_score, 2),
                                "delta": round(delta, 2),
                                "tier": new_tier,
                            })
                        except Exception:
                            pass

                    if new_tier != old_tier:
                        try:
                            deliver_event("tier_change", agent_id, {
                                "old_tier": old_tier,
                                "new_tier": new_tier,
                                "composite_score": round(new_score, 2),
                            })
                        except Exception:
                            pass
                except Exception:
                    pass

            self._insert_screenings_and_submit(db, rescreen_rows, "rescreen_stale")

        # ── Phase 3: Push updated scores on-chain (if enabled) ─────────
        logger.info("[screen_new_agents] Phase 3: Score push starting...")
        try:
            from services.score_pusher import push_scores
            pushed = push_scores()
            logger.info(f"[screen_new_agents] Phase 3 complete — pushed {pushed} scores on-chain")
        except Exception as e:
            logger.error(f"[screen_new_agents] Score push failed: {e}", exc_info=True)

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
                        # Record score crash as failure event
                        if swing > 30:
                            try:
                                db.table("failure_events").insert({
                                    "agent_id": aid,
                                    "failure_type": "score_crash",
                                    "severity": "critical" if swing > 40 else "high",
                                    "details": {"swing": round(swing, 1), "min": min(scores), "max": max(scores)},
                                    "source": "anomaly-monitor",
                                    "created_at": now.isoformat(),
                                }).execute()
                            except Exception:
                                pass
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

        # 3. Dormant agents suddenly receiving feedback (batched query)
        try:
            if recent_feedback_data:
                # Count recent feedbacks per agent
                recent_agent_counts: dict[int, int] = {}
                for fb in recent_feedback_data:
                    aid = fb["agent_id"]
                    recent_agent_counts[aid] = recent_agent_counts.get(aid, 0) + 1

                # Only check agents with 3+ recent feedbacks
                candidates = [aid for aid, cnt in recent_agent_counts.items() if cnt >= 3]
                if candidates:
                    # Single batch query: get agents that had ANY feedback before cutoff
                    older = (
                        db.table("reputation_events")
                        .select("agent_id")
                        .in_("agent_id", candidates[:50])
                        .lt("created_at", cutoff_24h)
                        .limit(len(candidates))
                        .execute()
                    )
                    agents_with_history = set(r["agent_id"] for r in (older.data or []))

                    for aid in candidates[:50]:
                        if aid not in agents_with_history:
                            alerts.append({
                                "agent_id": aid,
                                "alert_type": "dormant_activation",
                                "severity": "medium",
                                "details": f"Previously inactive agent received {recent_agent_counts[aid]} feedbacks in 24h",
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
        liveness_results: list[tuple[int, bool, str]] = []

        with httpx.Client(timeout=LIVENESS_TIMEOUT, follow_redirects=False) as client:
            for agent in agents_to_check:
                agent_id = agent["agent_id"]
                uri = agent["agent_uri"]
                reachable = False

                try:
                    from services.url_safety import is_safe_url
                    parsed = urlparse(uri)
                    base_url = f"{parsed.scheme}://{parsed.netloc}"

                    if not is_safe_url(base_url):
                        reachable = False
                        liveness_results.append((agent_id, False, uri))
                        continue

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

                liveness_results.append((agent_id, reachable, uri))

                # Record/resolve failure events for liveness
                if not reachable:
                    # Check if there's already an unresolved endpoint_down for this agent
                    try:
                        existing = (
                            db.table("failure_events")
                            .select("id")
                            .eq("agent_id", agent_id)
                            .eq("failure_type", "endpoint_down")
                            .is_("resolved_at", "null")
                            .limit(1)
                            .execute()
                        )
                        if not existing.data:
                            db.table("failure_events").insert({
                                "agent_id": agent_id,
                                "failure_type": "endpoint_down",
                                "severity": "high",
                                "details": {"endpoint": uri[:500]},
                                "source": "uptime-check",
                                "created_at": now.isoformat(),
                            }).execute()
                    except Exception:
                        pass

                    try:
                        deliver_event("unreachable", agent_id, {
                            "agent_uri": uri,
                            "reachable": False,
                        })
                    except Exception:
                        pass
                else:
                    # Resolve any open endpoint_down failures
                    try:
                        open_failures = (
                            db.table("failure_events")
                            .select("id, created_at")
                            .eq("agent_id", agent_id)
                            .eq("failure_type", "endpoint_down")
                            .is_("resolved_at", "null")
                            .execute()
                        )
                        for f in (open_failures.data or []):
                            try:
                                created = datetime.fromisoformat(
                                    f["created_at"].replace("Z", "+00:00")
                                )
                                resolution_seconds = int((now - created).total_seconds())
                            except Exception:
                                resolution_seconds = None
                            db.table("failure_events").update({
                                "resolved_at": now.isoformat(),
                                "resolution_time_seconds": resolution_seconds,
                            }).eq("id", f["id"]).execute()
                    except Exception:
                        pass

        logger.info(f"[verify_agent_liveness] Checked {checked}/{len(agents_to_check)} agents")

        # Submit on-chain liveness attestations
        chain = get_chain_service()
        if chain is not None and liveness_results:
            submitted = 0
            for agent_id, reachable, endpoint in liveness_results:
                score = 100 if reachable else 10
                comment = f"Liveness: reachable={reachable}, endpoint={endpoint[:200]}"
                try:
                    tx_hash = chain.submit_feedback(
                        agent_id, score, comment,
                        tag1="liveness", tag2="liveness-check",
                    )
                    if tx_hash:
                        submitted += 1
                        logger.info(
                            f"[verify_agent_liveness] On-chain liveness for agent {agent_id}: "
                            f"reachable={reachable} tx={tx_hash}"
                        )
                except Exception as e:
                    logger.error(
                        f"[verify_agent_liveness] On-chain liveness failed for agent {agent_id}: {e}"
                    )
                    continue
            if submitted > 0:
                logger.info(f"[verify_agent_liveness] Submitted {submitted} on-chain liveness attestations")

    # ─── Job 4: Publish Network Report (every 6 hours) ───────────────

    def _publish_network_report(self):
        """Generate and store a periodic network health report."""
        db = get_supabase()
        now = datetime.now(timezone.utc)

        # Verify oracle_reports table exists
        try:
            db.table("oracle_reports").select("id", count="exact").limit(0).execute()
        except Exception as e:
            if "does not exist" in str(e) or "404" in str(e):
                logger.warning("[publish_network_report] oracle_reports table not found — skipping")
                return
            # Other errors (e.g. Cloudflare HTML response) — skip gracefully
            if "<html>" in str(e).lower():
                logger.warning("[publish_network_report] Supabase returned HTML error — skipping")
                return
            raise

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

        # Avg trust score + tier distribution via RPC (avoids loading all rows)
        avg_score = 0.0
        try:
            avg_result = db.rpc("avg_composite_score", {}).execute()
            if avg_result.data and avg_result.data[0]:
                avg_score = round(float(avg_result.data[0].get("avg", 0) or 0), 2)
        except Exception:
            avg_score = 0.0

        tier_dist: dict[str, int] = {}
        try:
            tier_result = db.rpc("tier_distribution", {}).execute()
            if tier_result.data:
                for row in tier_result.data:
                    tier_dist[row["tier"] or "unranked"] = row["count"]
        except Exception:
            pass

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

        # Ensure report payload stays under Cloudflare/Supabase body limits
        import json
        report_json = json.dumps(report_data)
        if len(report_json) > 50_000:
            logger.warning(f"[publish_network_report] Truncating oversized report ({len(report_json)} bytes)")
            report_data = {
                "total_agents": total_agents,
                "new_agents": new_agents,
                "avg_trust_score": avg_score,
                "tier_distribution": {k: v for k, v in sorted(tier_dist.items(), key=lambda x: -x[1])[:20]},
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
            logger.error(
                f"[publish_network_report] Failed to insert report: {e} | "
                f"payload_size={len(json.dumps(report_data))} bytes"
            )

    # ─── Job 5: Sync GitHub Activity (every 10 min) ────────────────────

    def _sync_github_activity(self):
        """Poll GitHub for coding agent PR metrics."""
        from config import get_settings

        settings = get_settings()
        token = settings.github_token
        if not token:
            return  # Skip silently if no token configured

        from services.github_poller import GitHubPoller

        poller = GitHubPoller(github_token=token)
        try:
            count = poller.poll_agent_repos()
            if count:
                logger.info(f"[github] Updated git activity for {count} agents")
        finally:
            poller.close()

    # ─── Job 6: Sync Delegation Events (every 10 min) ────────────────

    def _sync_delegation_events(self):
        """Infer delegation relationships from marketplace tasks and agent reviews."""
        db = get_supabase()
        now = datetime.now(timezone.utc)
        inserted = 0

        # Phase 1: Infer from marketplace_tasks with client_agent_id
        try:
            tasks = (
                db.table("marketplace_tasks")
                .select("task_id, agent_id, client_agent_id, status, task_hash, deadline, created_at, completed_at")
                .not_.is_("client_agent_id", "null")
                .order("created_at", desc=True)
                .limit(200)
                .execute()
            )
        except Exception as e:
            logger.debug(f"[sync_delegation] marketplace_tasks query failed: {e}")
            tasks = type("R", (), {"data": []})()

        for task in (tasks.data or []):
            delegator = task.get("client_agent_id")
            delegate = task.get("agent_id")
            if not delegator or not delegate:
                continue

            # Check if already recorded
            try:
                existing = (
                    db.table("delegation_events")
                    .select("id")
                    .eq("delegator_agent_id", delegator)
                    .eq("delegate_agent_id", delegate)
                    .eq("task_hash", task.get("task_hash") or str(task.get("task_id")))
                    .limit(1)
                    .execute()
                )
                if existing.data:
                    continue
            except Exception:
                continue

            # Map status to outcome
            status = (task.get("status") or "pending").lower()
            if status == "completed":
                outcome = "success"
            elif status in ("cancelled", "disputed"):
                outcome = "failure"
            elif task.get("deadline"):
                try:
                    deadline = datetime.fromisoformat(
                        task["deadline"].replace("Z", "+00:00")
                    )
                    outcome = "timeout" if now > deadline else "pending"
                except Exception:
                    outcome = "pending"
            else:
                outcome = "pending"

            try:
                db.table("delegation_events").insert({
                    "delegator_agent_id": delegator,
                    "delegate_agent_id": delegate,
                    "task_scope": None,
                    "task_hash": task.get("task_hash") or str(task.get("task_id")),
                    "outcome": outcome,
                    "started_at": task.get("created_at", now.isoformat()),
                    "completed_at": task.get("completed_at"),
                    "source_chain": "avalanche",
                    "source": "marketplace",
                    "created_at": now.isoformat(),
                }).execute()
                inserted += 1

                # Record delegation failures
                if outcome in ("failure", "timeout"):
                    try:
                        db.table("failure_events").insert({
                            "agent_id": delegate,
                            "failure_type": "delegation_break",
                            "severity": "medium",
                            "details": {"delegator": delegator, "task_hash": task.get("task_hash"), "outcome": outcome},
                            "source": "delegation",
                            "created_at": now.isoformat(),
                        }).execute()
                    except Exception:
                        pass
            except Exception:
                pass

        # Phase 2: Infer from agent-review feedback (peer delegations)
        try:
            peer_reviews = (
                db.table("reputation_events")
                .select("agent_id, reviewer_address, created_at, rating")
                .eq("tag2", "agent-review")
                .order("created_at", desc=True)
                .limit(100)
                .execute()
            )
            for review in (peer_reviews.data or []):
                reviewer_addr = review.get("reviewer_address", "")
                # Look up if reviewer is a registered agent
                try:
                    reviewer_agent = (
                        db.table("agents")
                        .select("agent_id")
                        .eq("owner_address", reviewer_addr)
                        .limit(1)
                        .execute()
                    )
                    if not reviewer_agent.data:
                        continue
                    delegator_id = reviewer_agent.data[0]["agent_id"]
                    delegate_id = review["agent_id"]

                    # Check if already recorded
                    existing = (
                        db.table("delegation_events")
                        .select("id")
                        .eq("delegator_agent_id", delegator_id)
                        .eq("delegate_agent_id", delegate_id)
                        .eq("source", "agent-review")
                        .limit(1)
                        .execute()
                    )
                    if existing.data:
                        continue

                    outcome = "success" if review.get("rating", 50) >= 50 else "failure"
                    db.table("delegation_events").insert({
                        "delegator_agent_id": delegator_id,
                        "delegate_agent_id": delegate_id,
                        "task_scope": None,
                        "task_hash": None,
                        "outcome": outcome,
                        "started_at": review.get("created_at", now.isoformat()),
                        "completed_at": review.get("created_at"),
                        "source_chain": "avalanche",
                        "source": "agent-review",
                        "created_at": now.isoformat(),
                    }).execute()
                    inserted += 1
                except Exception:
                    pass
        except Exception as e:
            logger.debug(f"[sync_delegation] agent-review scan failed: {e}")

        if inserted:
            logger.info(f"[sync_delegation] Inserted {inserted} delegation events")

    # ─── Job 7: Compute Failure Metrics (every 30 min) ───────────────

    def _compute_failure_metrics(self):
        """Compute failure counts and MTTR, update agents table cache."""
        db = get_supabase()

        # Get distinct agents with failure events
        try:
            recent = (
                db.table("failure_events")
                .select("agent_id")
                .order("created_at", desc=True)
                .limit(500)
                .execute()
            )
        except Exception as e:
            logger.debug(f"[failure_metrics] Query failed: {e}")
            return

        agent_ids = list(set(r["agent_id"] for r in (recent.data or [])))
        if not agent_ids:
            return

        updated = 0
        for agent_id in agent_ids[:100]:
            try:
                failures = (
                    db.table("failure_events")
                    .select("resolution_time_seconds, resolved_at, created_at")
                    .eq("agent_id", agent_id)
                    .execute()
                )
                if not failures.data:
                    continue

                total = len(failures.data)
                resolved = [
                    f for f in failures.data
                    if f.get("resolution_time_seconds") is not None
                ]
                mttr = None
                if resolved:
                    mttr = int(
                        sum(f["resolution_time_seconds"] for f in resolved)
                        / len(resolved)
                    )

                last_failure = max(
                    (f["created_at"] for f in failures.data),
                    default=None,
                )

                db.table("agents").update({
                    "failure_count": total,
                    "mttr_seconds": mttr,
                    "last_failure_at": last_failure,
                }).eq("agent_id", agent_id).execute()
                updated += 1
            except Exception:
                pass

        if updated:
            logger.info(f"[failure_metrics] Updated metrics for {updated} agents")


    def _sync_job_outcomes(self):
        """Sync ERC-8183 job outcomes and compute completion rates for scored agents."""
        db = get_supabase()

        # Fetch agents that have job outcome data
        try:
            result = (
                db.table("job_outcomes")
                .select("agent_id")
                .order("created_at", desc=True)
                .limit(500)
                .execute()
            )
        except Exception as e:
            logger.debug(f"[job_outcomes] Query failed (table may not exist yet): {e}")
            return

        agent_ids = list(set(r["agent_id"] for r in (result.data or [])))
        if not agent_ids:
            return

        updated = 0
        for agent_id in agent_ids[:100]:
            try:
                jobs = (
                    db.table("job_outcomes")
                    .select("completed")
                    .eq("agent_id", agent_id)
                    .execute()
                )
                if not jobs.data:
                    continue

                total = len(jobs.data)
                completed = sum(1 for j in jobs.data if j["completed"])
                rate = round((completed / total) * 100, 2) if total > 0 else 0

                db.table("agents").update({
                    "job_completion_rate": rate,
                    "job_count": total,
                }).eq("agent_id", agent_id).execute()
                updated += 1

                # Invalidate trust cache for this agent
                get_trust_cache().invalidate(f"eval:{agent_id}")
            except Exception:
                pass

        if updated:
            logger.info(f"[job_outcomes] Updated job metrics for {updated} agents")

    def _crawl_capabilities(self):
        """Crawl agent URIs and A2A cards to index capabilities and endpoints."""
        import asyncio as _asyncio
        from services.capability_crawler import CapabilityCrawler

        db = get_supabase()
        crawler = CapabilityCrawler(db)

        try:
            loop = _asyncio.new_event_loop()
            stats = loop.run_until_complete(crawler.crawl_all(limit=200))
            loop.run_until_complete(crawler.close())
            loop.close()

            logger.info(
                f"[capabilities] Crawl complete — "
                f"crawled={stats['crawled']} "
                f"capabilities={stats['capabilities_found']} "
                f"endpoints={stats['endpoints_found']}"
            )
        except Exception as e:
            logger.error(f"[capabilities] Crawl failed: {e}")


# Singleton
_screener: AgentScreener | None = None


def get_screener() -> AgentScreener:
    global _screener
    if _screener is None:
        _screener = AgentScreener()
    return _screener
