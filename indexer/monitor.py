#!/usr/bin/env python3
"""
AgentProof Monitor Service — Endpoint Ping Service

Reads active endpoints from Supabase, pings each with httpx (GET, 10s timeout)
every 60 seconds. Writes results to uptime_checks and hourly computes
uptime_daily_summary.
"""

import asyncio
import logging
import sys
from datetime import datetime, timezone

import httpx
from supabase import create_client

from config import SUPABASE_URL, SUPABASE_KEY

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("monitor")

PING_INTERVAL = 60  # seconds
SUMMARY_INTERVAL = 3600  # 1 hour


class EndpointMonitor:
    def __init__(self):
        if not SUPABASE_URL or not SUPABASE_KEY:
            logger.error("Supabase URL and key must be configured")
            sys.exit(1)

        self.db = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.last_summary = datetime.now(timezone.utc)
        logger.info("Monitor service initialized")

    def get_active_endpoints(self) -> list[dict]:
        """Fetch all active endpoints from Supabase."""
        try:
            result = (
                self.db.table("agent_monitoring_endpoints")
                .select("*")
                .eq("is_active", True)
                .execute()
            )
            return result.data
        except Exception as e:
            logger.error(f"Error fetching endpoints: {e}")
            return []

    async def ping_endpoint(self, endpoint: dict) -> dict:
        """Ping a single endpoint and return the result."""
        url = endpoint["url"]
        agent_id = endpoint["agent_id"]
        endpoint_index = endpoint["endpoint_index"]

        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                start = asyncio.get_event_loop().time()
                response = await client.get(url)
                latency_ms = int((asyncio.get_event_loop().time() - start) * 1000)

                is_up = response.status_code < 500
                return {
                    "agent_id": agent_id,
                    "endpoint_index": endpoint_index,
                    "is_up": is_up,
                    "latency_ms": latency_ms,
                    "response_code": response.status_code,
                }
        except httpx.TimeoutException:
            return {
                "agent_id": agent_id,
                "endpoint_index": endpoint_index,
                "is_up": False,
                "latency_ms": 10000,
                "response_code": 0,
            }
        except Exception as e:
            logger.debug(f"Ping failed for agent #{agent_id} ep#{endpoint_index}: {e}")
            return {
                "agent_id": agent_id,
                "endpoint_index": endpoint_index,
                "is_up": False,
                "latency_ms": 0,
                "response_code": 0,
            }

    def record_check(self, result: dict):
        """Write an uptime check record to Supabase."""
        try:
            self.db.table("uptime_checks").insert({
                "agent_id": result["agent_id"],
                "endpoint_index": result["endpoint_index"],
                "is_up": result["is_up"],
                "latency_ms": result["latency_ms"],
                "response_code": result["response_code"],
                "checked_at": datetime.now(timezone.utc).isoformat(),
                "source": "monitor",
            }).execute()
        except Exception as e:
            logger.error(f"Error recording check: {e}")

    def compute_daily_summary(self):
        """Compute daily uptime summary for all agents."""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        try:
            # Get all checks for today
            checks = (
                self.db.table("uptime_checks")
                .select("agent_id,is_up,latency_ms")
                .gte("checked_at", f"{today}T00:00:00Z")
                .execute()
            )
        except Exception as e:
            logger.error(f"Error fetching checks for summary: {e}")
            return

        # Group by agent
        agents: dict[int, dict] = {}
        for check in checks.data:
            aid = check["agent_id"]
            if aid not in agents:
                agents[aid] = {"total": 0, "successful": 0, "latencies": []}
            agents[aid]["total"] += 1
            if check["is_up"]:
                agents[aid]["successful"] += 1
                if check["latency_ms"] and check["latency_ms"] > 0:
                    agents[aid]["latencies"].append(check["latency_ms"])

        for agent_id, data in agents.items():
            uptime_pct = round((data["successful"] / data["total"]) * 100, 2) if data["total"] > 0 else 0
            avg_latency = round(sum(data["latencies"]) / len(data["latencies"])) if data["latencies"] else 0

            try:
                self.db.table("uptime_daily_summary").upsert(
                    {
                        "agent_id": agent_id,
                        "summary_date": today,
                        "total_checks": data["total"],
                        "successful_checks": data["successful"],
                        "uptime_pct": uptime_pct,
                        "avg_latency_ms": avg_latency,
                    },
                    on_conflict="agent_id,summary_date",
                ).execute()
            except Exception as e:
                logger.error(f"Error upserting summary for agent #{agent_id}: {e}")

        logger.info(f"Daily summary computed for {len(agents)} agents")

    async def run_cycle(self):
        """Run one monitoring cycle."""
        endpoints = self.get_active_endpoints()
        if not endpoints:
            return

        # Ping all endpoints concurrently
        tasks = [self.ping_endpoint(ep) for ep in endpoints]
        results = await asyncio.gather(*tasks)

        up_count = sum(1 for r in results if r["is_up"])
        logger.info(f"Pinged {len(results)} endpoints: {up_count} up, {len(results) - up_count} down")

        # Record results
        for result in results:
            self.record_check(result)

        # Compute summary every hour
        now = datetime.now(timezone.utc)
        if (now - self.last_summary).total_seconds() >= SUMMARY_INTERVAL:
            self.compute_daily_summary()
            self.last_summary = now

    async def run(self):
        """Main loop."""
        logger.info(f"Starting monitor service (ping interval: {PING_INTERVAL}s)")

        while True:
            try:
                await self.run_cycle()
            except KeyboardInterrupt:
                logger.info("Shutting down monitor service...")
                break
            except Exception as e:
                logger.error(f"Monitor cycle error: {e}", exc_info=True)

            await asyncio.sleep(PING_INTERVAL)


if __name__ == "__main__":
    monitor = EndpointMonitor()
    asyncio.run(monitor.run())
