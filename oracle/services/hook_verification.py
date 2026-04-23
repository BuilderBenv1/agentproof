"""
AgentProofHook (ERC-8183) job verification.

Closes the "unverified service" attack vector: before accepting a rating, check
that the referenced jobId was actually recorded as completed on-chain by the
AgentProofHook's afterAction. The hook emits:

    event JobOutcomeRecorded(uint256 indexed agentId, uint256 indexed jobId, bool completed)

We filter logs by (topic0 = event sig, topic1 = agentId, topic2 = jobId). A
single matching log with completed == true proves the provider served this
specific job. Without such a log, the rating is not anchored to any service.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass
from typing import Optional

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

from config import get_settings

logger = logging.getLogger(__name__)

# keccak256("JobOutcomeRecorded(uint256,uint256,bool)")
_JOB_OUTCOME_TOPIC = Web3.keccak(text="JobOutcomeRecorded(uint256,uint256,bool)").hex()
if not _JOB_OUTCOME_TOPIC.startswith("0x"):
    _JOB_OUTCOME_TOPIC = "0x" + _JOB_OUTCOME_TOPIC

# Chains with POA extraData (otherwise web3 barfs on block lookups)
_POA_CHAINS = {"avalanche", "polygon", "bsc", "gnosis"}


@dataclass
class JobVerification:
    """Outcome of a hook lookup for (chain, jobId, expected_agent_id)."""
    verified: bool
    reason: str | None
    completed: bool = False
    block_number: int | None = None
    tx_hash: str | None = None
    hook_address: str | None = None


class HookVerificationService:
    """
    Queries AgentProofHook event logs to prove a rating is anchored to a real
    completed job. Results are cached in memory because log queries are
    expensive and JobOutcomeRecorded events are immutable once mined.
    """

    def __init__(self) -> None:
        self._w3_cache: dict[str, Web3] = {}
        self._result_cache: dict[tuple[str, str, int, int], JobVerification] = {}
        self._lock = threading.Lock()

    def hook_address(self, chain: str) -> str | None:
        """Return the configured AgentProofHook address for `chain`, or None."""
        settings = get_settings()
        addr = getattr(settings, f"agentproof_hook_{chain}", "") or ""
        return addr.strip() or None

    def is_configured(self, chain: str) -> bool:
        return self.hook_address(chain) is not None

    def verify_job(
        self,
        chain: str,
        job_id: int,
        expected_agent_id: int,
    ) -> JobVerification:
        """
        Look up a JobOutcomeRecorded event on `chain` for (agentId, jobId).

        Returns JobVerification.verified == True only when:
          1. A matching event exists on-chain at the configured hook address
          2. completed == true
          3. The agentId in the event matches `expected_agent_id`

        On any failure (no RPC, no hook configured, RPC error, no matching log,
        completed == false), returns verified == False with a `reason`.
        """
        hook_addr = self.hook_address(chain)
        if not hook_addr:
            return JobVerification(
                verified=False,
                reason="hook_not_configured_for_chain",
            )

        cache_key = (chain, hook_addr.lower(), int(job_id), int(expected_agent_id))
        with self._lock:
            cached = self._result_cache.get(cache_key)
        if cached is not None:
            return cached

        w3 = self._get_w3(chain)
        if w3 is None:
            return JobVerification(
                verified=False,
                reason="rpc_unavailable",
                hook_address=hook_addr,
            )

        settings = get_settings()
        try:
            latest = w3.eth.block_number
        except Exception as e:
            logger.warning(f"[{chain}] block_number failed: {e}")
            return JobVerification(
                verified=False,
                reason="rpc_error",
                hook_address=hook_addr,
            )

        scan_span = max(1, int(settings.hook_event_scan_blocks))
        from_block = max(0, latest - scan_span)

        topic_agent = "0x" + format(int(expected_agent_id), "064x")
        topic_job = "0x" + format(int(job_id), "064x")

        try:
            logs = w3.eth.get_logs({
                "fromBlock": from_block,
                "toBlock": latest,
                "address": Web3.to_checksum_address(hook_addr),
                "topics": [_JOB_OUTCOME_TOPIC, topic_agent, topic_job],
            })
        except Exception as e:
            logger.warning(
                f"[{chain}] get_logs failed for hook={hook_addr} "
                f"agent={expected_agent_id} job={job_id}: {e}"
            )
            return JobVerification(
                verified=False,
                reason="log_query_failed",
                hook_address=hook_addr,
            )

        if not logs:
            return JobVerification(
                verified=False,
                reason="no_job_outcome_recorded",
                hook_address=hook_addr,
            )

        # Use the most recent log. Decode `completed` from data (single bool padded to 32 bytes).
        log = logs[-1]
        raw_data = log["data"]
        if isinstance(raw_data, (bytes, bytearray)):
            data_hex = raw_data.hex()
        else:
            data_hex = str(raw_data)
        data_hex = data_hex.removeprefix("0x")
        try:
            completed = int(data_hex, 16) == 1 if data_hex else False
        except ValueError:
            completed = False

        tx_hash_raw = log.get("transactionHash")
        if hasattr(tx_hash_raw, "hex"):
            tx_hash = tx_hash_raw.hex()
            if not tx_hash.startswith("0x"):
                tx_hash = "0x" + tx_hash
        else:
            tx_hash = str(tx_hash_raw) if tx_hash_raw else None

        result = JobVerification(
            verified=bool(completed),
            reason=None if completed else "job_not_completed",
            completed=bool(completed),
            block_number=int(log.get("blockNumber") or 0) or None,
            tx_hash=tx_hash,
            hook_address=hook_addr,
        )

        # Only cache definitive "job exists" answers. Transient failures should be retried.
        with self._lock:
            self._result_cache[cache_key] = result

        return result

    # ── Internals ─────────────────────────────────────────────────────

    def _get_w3(self, chain: str) -> Optional[Web3]:
        with self._lock:
            if chain in self._w3_cache:
                return self._w3_cache[chain]

        settings = get_settings()
        rpc = getattr(settings, f"{chain}_rpc_url", "") or ""
        if not rpc.strip():
            return None

        try:
            w3 = Web3(Web3.HTTPProvider(rpc))
            if chain in _POA_CHAINS:
                w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
        except Exception as e:
            logger.warning(f"[{chain}] web3 init failed: {e}")
            return None

        with self._lock:
            self._w3_cache[chain] = w3
        return w3


_service: HookVerificationService | None = None


def get_hook_verification_service() -> HookVerificationService:
    """Lazy singleton — avoids constructing web3 clients at import time."""
    global _service
    if _service is None:
        _service = HookVerificationService()
    return _service
