"""
ReputationGatedTreasurer — AgentProof × Ampersend integration.

An X402Treasurer that gates payment authorization on AgentProof reputation
scores. Before signing a payment to a counterparty agent, it queries the
AgentProof oracle. Below threshold → blocked. Above threshold → proceeds.

    Discover → Verify → Transact

Usage::

    from reputation_gated_treasurer import ReputationGatedTreasurer
    from ampersend_sdk.x402.wallets.account import AccountWallet
    from eth_account import Account

    wallet = AccountWallet(Account.from_key(PRIVATE_KEY))
    treasurer = ReputationGatedTreasurer(
        wallet=wallet,
        agentproof_api_key="ap_live_...",
        min_score=50.0,
        min_tier="bronze",
    )
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

import httpx

from ampersend_sdk.x402.treasurer import X402Authorization, X402Treasurer
from ampersend_sdk.x402.wallet import X402Wallet
from x402.types import PaymentRequirements
from x402_a2a import PaymentStatus, x402PaymentRequiredResponse

logger = logging.getLogger("agentproof.treasurer")

# ─── Tier Ordering ────────────────────────────────────────────────

TIER_ORDER = {
    "unranked": 0,
    "bronze": 1,
    "silver": 2,
    "gold": 3,
    "platinum": 4,
    "diamond": 5,
}


# ─── Exceptions ───────────────────────────────────────────────────


class ReputationGatedException(Exception):
    """Raised when a counterparty fails the reputation gate."""

    def __init__(
        self,
        address: str,
        score: float | None = None,
        tier: str | None = None,
        reason: str = "",
    ):
        self.address = address
        self.score = score
        self.tier = tier
        self.reason = reason
        parts = [f"Payment to {address} blocked by AgentProof reputation gate"]
        if score is not None:
            parts.append(f"score={score}")
        if tier:
            parts.append(f"tier={tier}")
        if reason:
            parts.append(reason)
        super().__init__(" — ".join(parts))


class AgentNotRegistered(ReputationGatedException):
    """Counterparty address has no AgentProof identity."""

    def __init__(self, address: str):
        super().__init__(address, reason="no ERC-8004 identity registered")


# ─── Resolution Result ───────────────────────────────────────────


@dataclass
class TrustResult:
    """Trust score resolution from the AgentProof oracle."""

    address: str
    agent_id: int
    score: float
    tier: str
    tier_num: int
    updated_at: str | None = None


# ─── Score Cache ──────────────────────────────────────────────────


@dataclass
class _CacheEntry:
    result: TrustResult
    hit_count: int = 0


# ─── Treasurer ────────────────────────────────────────────────────


class ReputationGatedTreasurer(X402Treasurer):
    """
    X402Treasurer that checks AgentProof reputation before authorizing
    payments to counterparty agents.

    The gate evaluates two conditions (both must pass):
      1. ``score >= min_score``     (composite reputation score, 0-100)
      2. ``tier_num >= min_tier``   (ordinal tier: 0=unranked … 5=diamond)

    Parameters
    ----------
    wallet : X402Wallet
        The wallet used to sign x402 payments (EOA or Smart Account).
    agentproof_api_key : str
        API key for the AgentProof oracle (``ap_live_...`` or ``ap_test_...``).
    min_score : float
        Minimum composite score required (default 30.0).
    min_tier : str | int
        Minimum tier name or number (default ``"bronze"`` / 1).
    oracle_url : str
        AgentProof oracle base URL.
    chain : str
        Chain context passed to the oracle (default ``"base"``).
    cache_size : int
        Max addresses to cache (0 = no cache). Scores are cached for
        the lifetime of the treasurer instance to avoid redundant lookups
        within a single session. Default 256.
    timeout : float
        HTTP timeout for oracle calls in seconds.
    """

    def __init__(
        self,
        wallet: X402Wallet,
        agentproof_api_key: str,
        *,
        min_score: float = 30.0,
        min_tier: str | int = "bronze",
        oracle_url: str = "https://oracle.agentproof.sh",
        chain: str = "base",
        cache_size: int = 256,
        timeout: float = 10.0,
    ):
        self._wallet = wallet
        self._api_key = agentproof_api_key
        self._min_score = min_score
        self._min_tier_num = (
            TIER_ORDER.get(min_tier, 0) if isinstance(min_tier, str) else int(min_tier)
        )
        self._min_tier_name = (
            min_tier
            if isinstance(min_tier, str)
            else next((k for k, v in TIER_ORDER.items() if v == min_tier), "unranked")
        )
        self._oracle_url = oracle_url.rstrip("/")
        self._chain = chain
        self._cache_size = cache_size
        self._timeout = timeout

        self._cache: dict[str, _CacheEntry] = {}
        self._http = httpx.AsyncClient(
            timeout=timeout,
            headers={
                "X-API-Key": agentproof_api_key,
                "Accept": "application/json",
            },
        )

        # Stats
        self._payments_approved = 0
        self._payments_blocked = 0

    # ── X402Treasurer interface ─────────────────────────────────

    async def onPaymentRequired(
        self,
        payment_required: x402PaymentRequiredResponse,
        context: dict[str, Any] | None = None,
    ) -> X402Authorization | None:
        """
        Intercept payment authorization. Resolve the counterparty's
        AgentProof score and gate on min_score + min_tier.
        """
        requirement = payment_required.accepts[0]
        counterparty = requirement.payTo

        # Resolve trust score
        trust = await self.resolve_trust(counterparty)

        # Evaluate gate
        if trust.score < self._min_score:
            self._payments_blocked += 1
            raise ReputationGatedException(
                counterparty,
                score=trust.score,
                tier=trust.tier,
                reason=f"score {trust.score} < required {self._min_score}",
            )

        if trust.tier_num < self._min_tier_num:
            self._payments_blocked += 1
            raise ReputationGatedException(
                counterparty,
                score=trust.score,
                tier=trust.tier,
                reason=f"tier {trust.tier} < required {self._min_tier_name}",
            )

        # Gate passed — sign payment
        logger.info(
            "Payment approved: %s (score=%.1f, tier=%s, agent_id=%d)",
            counterparty,
            trust.score,
            trust.tier,
            trust.agent_id,
        )
        self._payments_approved += 1

        payment = self._wallet.create_payment(requirements=requirement)
        return X402Authorization(
            payment=payment,
            authorization_id=uuid.uuid4().hex,
            selected_requirement=requirement,
        )

    async def onStatus(
        self,
        status: PaymentStatus,
        authorization: X402Authorization,
        context: dict[str, Any] | None = None,
    ) -> None:
        """Log payment status updates."""
        logger.info(
            "Payment %s: status=%s, payTo=%s",
            authorization.authorization_id,
            status,
            authorization.selected_requirement.payTo,
        )

    # ── Trust Resolution ────────────────────────────────────────

    async def resolve_trust(self, address: str) -> TrustResult:
        """
        Resolve an Ethereum address to its AgentProof trust score.

        Uses the oracle's ``/api/v1/hook/resolve/{address}`` endpoint,
        which mirrors the on-chain AddressResolver contract.

        Raises
        ------
        AgentNotRegistered
            If the address has no ERC-8004 identity.
        """
        addr_lower = address.lower()

        # Check cache
        if addr_lower in self._cache:
            entry = self._cache[addr_lower]
            entry.hit_count += 1
            return entry.result

        # Query oracle
        url = f"{self._oracle_url}/api/v1/hook/resolve/{address}"
        resp = await self._http.get(url)

        if resp.status_code == 404:
            raise AgentNotRegistered(address)

        resp.raise_for_status()
        data = resp.json()

        result = TrustResult(
            address=data["address"],
            agent_id=data["agent_id"],
            score=float(data["score"]),
            tier=data["tier"],
            tier_num=data["tier_num"],
            updated_at=data.get("updated_at"),
        )

        # Cache (evict oldest if full)
        if self._cache_size > 0:
            if len(self._cache) >= self._cache_size:
                oldest = min(self._cache, key=lambda k: self._cache[k].hit_count)
                del self._cache[oldest]
            self._cache[addr_lower] = _CacheEntry(result=result)

        return result

    # ── Convenience ─────────────────────────────────────────────

    @property
    def stats(self) -> dict[str, int]:
        return {
            "approved": self._payments_approved,
            "blocked": self._payments_blocked,
            "cache_size": len(self._cache),
        }

    async def close(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> ReputationGatedTreasurer:
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.close()
