"""SVG badge endpoints — embeddable trust badges for GitHub READMEs, docs, and websites.

Usage:
  ![AgentProof](https://oracle.agentproof.sh/api/v1/badge/1380.svg)
  ![AgentProof](https://oracle.agentproof.sh/api/v1/badge/1380.svg?style=minimal)
"""

import logging
from fastapi import APIRouter, Query
from fastapi.responses import Response

from services.trust import get_trust_service, get_trust_cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/badge", tags=["badges"])

# ── Tier colours ─────────────────────────────────────────────
TIER_COLORS = {
    "diamond": "9333ea",
    "platinum": "0891b2",
    "gold": "eab308",
    "silver": "9ca3af",
    "bronze": "b45309",
    "unranked": "6b7280",
}

TIER_GLOW_COLORS = {
    "diamond": "9333ea",
    "platinum": "06b6d4",
    "gold": "facc15",
    "silver": "d1d5db",
    "bronze": "d97706",
    "unranked": "9ca3af",
}

RECOMMENDATION_COLORS = {
    "TRUSTED": "00ff88",
    "CAUTION": "ffaa00",
    "HIGH_RISK": "ff3344",
    "UNVERIFIED": "6b7280",
}


# ── Shield icon path (16x16 viewBox) ─────────────────────────
SHIELD_PATH = "M8 1.5L2 4.5V8.5C2 12.14 4.56 15.5 8 16.5C11.44 15.5 14 12.14 14 8.5V4.5L8 1.5Z"
CHECK_PATH = "M5.5 8.5L7 10L10.5 6.5"


def _branded_svg(score: float, tier: str, agent_id: int, style: str = "default") -> str:
    """Generate a premium AgentProof badge with dark aesthetic."""
    color = TIER_COLORS.get(tier, "6b7280")
    glow = TIER_GLOW_COLORS.get(tier, "6b7280")

    if style == "minimal":
        return _minimal_svg(score, tier, color, glow)
    elif style == "compact":
        return _compact_svg(score, tier, color, glow)
    else:
        return _default_svg(score, tier, agent_id, color, glow)


def _default_svg(score: float, tier: str, agent_id: int, color: str, glow: str) -> str:
    """Full badge — shield icon, score bar, tier, agent ID."""
    score_pct = min(100, max(0, score))
    bar_width = score_pct * 0.88  # 88px max bar width

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="220" height="34" role="img" aria-label="AgentProof: {tier} {score:.1f}">
  <title>AgentProof Trust Score: {score:.1f} ({tier})</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="220" y2="0">
      <stop offset="0%" stop-color="#0a0a0f"/>
      <stop offset="100%" stop-color="#111118"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#{color}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#{color}"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- Background -->
  <rect width="220" height="34" rx="6" fill="url(#bg)" stroke="#2a2a3a" stroke-width="1"/>
  <!-- Shield icon -->
  <g transform="translate(8, 5)" filter="url(#glow)">
    <g transform="scale(1.5)">
      <path d="{SHIELD_PATH}" fill="none" stroke="#{color}" stroke-width="1.2" stroke-linejoin="round" opacity="0.9"/>
      <path d="{CHECK_PATH}" fill="none" stroke="#{color}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
    </g>
  </g>
  <!-- AgentProof text -->
  <text x="36" y="14" font-family="ui-monospace,SFMono-Regular,Menlo,Monaco,monospace" font-size="9" fill="#8888aa" font-weight="500">AGENTPROOF</text>
  <!-- Score value -->
  <text x="204" y="14" font-family="ui-monospace,SFMono-Regular,Menlo,Monaco,monospace" font-size="11" fill="white" font-weight="700" text-anchor="end">{score:.1f}</text>
  <!-- Score bar track -->
  <rect x="36" y="20" width="88" height="5" rx="2.5" fill="#1a1a24"/>
  <!-- Score bar fill -->
  <rect x="36" y="20" width="{bar_width:.1f}" height="5" rx="2.5" fill="url(#bar)">
    <animate attributeName="width" from="0" to="{bar_width:.1f}" dur="0.8s" fill="freeze"/>
  </rect>
  <!-- Tier badge -->
  <rect x="130" y="18" rx="3" width="{len(tier) * 6.5 + 10:.0f}" height="13" fill="#{color}" fill-opacity="0.12" stroke="#{color}" stroke-opacity="0.3" stroke-width="0.5"/>
  <text x="{130 + (len(tier) * 6.5 + 10) / 2:.0f}" y="27" font-family="ui-monospace,SFMono-Regular,Menlo,Monaco,monospace" font-size="8" fill="#{color}" text-anchor="middle" font-weight="600">{tier.upper()}</text>
</svg>'''


def _minimal_svg(score: float, tier: str, color: str, glow: str) -> str:
    """Minimal badge — just shield + score + tier dot."""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="130" height="26" role="img" aria-label="AgentProof: {tier} {score:.1f}">
  <title>AgentProof Trust Score: {score:.1f} ({tier})</title>
  <defs>
    <filter id="g"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="130" height="26" rx="5" fill="#0a0a0f" stroke="#2a2a3a" stroke-width="1"/>
  <!-- Shield -->
  <g transform="translate(6, 3)" filter="url(#g)">
    <g transform="scale(1.25)">
      <path d="{SHIELD_PATH}" fill="none" stroke="#{color}" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="{CHECK_PATH}" fill="none" stroke="#{color}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
  <!-- Score -->
  <text x="32" y="17" font-family="ui-monospace,SFMono-Regular,Menlo,Monaco,monospace" font-size="12" fill="white" font-weight="700">{score:.1f}</text>
  <!-- Tier pill -->
  <rect x="{130 - len(tier) * 6 - 18:.0f}" y="7" rx="3" width="{len(tier) * 6 + 10:.0f}" height="13" fill="#{color}" fill-opacity="0.15" stroke="#{color}" stroke-opacity="0.3" stroke-width="0.5"/>
  <text x="{130 - len(tier) * 6 / 2 - 13:.0f}" y="16.5" font-family="ui-monospace,SFMono-Regular,Menlo,Monaco,monospace" font-size="7.5" fill="#{color}" text-anchor="middle" font-weight="600">{tier.upper()}</text>
</svg>'''


def _compact_svg(score: float, tier: str, color: str, glow: str) -> str:
    """Compact inline badge — shield + score only, for tight spaces."""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="78" height="22" role="img" aria-label="AgentProof: {score:.1f}">
  <title>AgentProof Trust Score: {score:.1f} ({tier})</title>
  <rect width="78" height="22" rx="4" fill="#0a0a0f" stroke="#{color}" stroke-width="0.8" stroke-opacity="0.4"/>
  <!-- Shield -->
  <g transform="translate(5, 3)">
    <path d="{SHIELD_PATH}" fill="none" stroke="#{color}" stroke-width="1" stroke-linejoin="round"/>
    <path d="{CHECK_PATH}" fill="none" stroke="#{color}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <!-- Score -->
  <text x="26" y="15" font-family="ui-monospace,SFMono-Regular,Menlo,Monaco,monospace" font-size="10" fill="white" font-weight="700">{score:.1f}</text>
  <!-- Tier dot -->
  <circle cx="68" cy="11" r="3.5" fill="#{color}" opacity="0.8"/>
</svg>'''


def _error_svg(label: str, message: str, style: str) -> str:
    """Error/not-found badge in the same dark aesthetic."""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="160" height="26" role="img" aria-label="{label}: {message}">
  <title>{label}: {message}</title>
  <rect width="160" height="26" rx="5" fill="#0a0a0f" stroke="#2a2a3a" stroke-width="1"/>
  <g transform="translate(6, 3)">
    <g transform="scale(1.25)">
      <path d="{SHIELD_PATH}" fill="none" stroke="#6b7280" stroke-width="1.2" stroke-linejoin="round"/>
    </g>
  </g>
  <text x="32" y="16" font-family="ui-monospace,SFMono-Regular,Menlo,Monaco,monospace" font-size="9" fill="#8888aa">{label}</text>
  <text x="154" y="16" font-family="ui-monospace,SFMono-Regular,Menlo,Monaco,monospace" font-size="9" fill="#6b7280" text-anchor="end">{message}</text>
</svg>'''


# ── Endpoints ────────────────────────────────────────────────

@router.get("/{agent_id}.svg")
async def badge_score(
    agent_id: int,
    style: str = Query("default", description="Badge style", enum=["default", "minimal", "compact"]),
    chain: str | None = Query(None, description="Source chain"),
):
    """SVG badge showing agent trust score and tier.

    Embed in markdown:
    ```
    ![AgentProof](https://oracle.agentproof.sh/api/v1/badge/1380.svg)
    ```

    Styles:
    - `default` — full badge with score bar, tier pill, shield icon (220x34)
    - `minimal` — shield + score + tier pill (130x26)
    - `compact` — shield + score + tier dot, for inline use (78x22)
    """
    cache = get_trust_cache()
    cache_key = f"badge:v2:{agent_id}:{chain}:{style}"
    cached = cache.get(cache_key)
    if cached:
        return Response(
            content=cached,
            media_type="image/svg+xml",
            headers={"Cache-Control": "public, max-age=300", "X-Cache": "HIT"},
        )

    try:
        svc = get_trust_service()
        result = svc.evaluate_agent(agent_id, chain=chain)
    except ValueError:
        svg = _error_svg("agentproof", "not found", style)
        return Response(
            content=svg,
            media_type="image/svg+xml",
            headers={"Cache-Control": "public, max-age=60"},
        )
    except Exception as e:
        logger.error(f"Badge error for agent #{agent_id}: {e}")
        svg = _error_svg("agentproof", "error", style)
        return Response(content=svg, media_type="image/svg+xml")

    svg = _branded_svg(result.composite_score, result.tier, agent_id, style)

    cache.set(cache_key, svg, ttl=300)
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=300", "X-Cache": "MISS"},
    )


@router.get("/tier/{agent_id}.svg")
async def badge_tier(
    agent_id: int,
    style: str = Query("default", enum=["default", "minimal", "compact"]),
    chain: str | None = Query(None),
):
    """SVG badge showing tier only."""
    try:
        svc = get_trust_service()
        result = svc.evaluate_agent(agent_id, chain=chain)
    except ValueError:
        svg = _error_svg("trust tier", "not found", style)
        return Response(content=svg, media_type="image/svg+xml")

    svg = _branded_svg(result.composite_score, result.tier, agent_id, style)
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=300"},
    )


@router.get("/score/{agent_id}.svg")
async def badge_score_only(
    agent_id: int,
    style: str = Query("default", enum=["default", "minimal", "compact"]),
    chain: str | None = Query(None),
):
    """SVG badge showing numeric score."""
    try:
        svc = get_trust_service()
        result = svc.evaluate_agent(agent_id, chain=chain)
    except ValueError:
        svg = _error_svg("trust score", "N/A", style)
        return Response(content=svg, media_type="image/svg+xml")

    svg = _branded_svg(result.composite_score, result.tier, agent_id, style)
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=300"},
    )


@router.get("/recommendation/{agent_id}.svg")
async def badge_recommendation(
    agent_id: int,
    style: str = Query("default", enum=["default", "minimal", "compact"]),
    chain: str | None = Query(None),
):
    """SVG badge showing recommendation (TRUSTED / CAUTION / HIGH_RISK)."""
    try:
        svc = get_trust_service()
        result = svc.evaluate_agent(agent_id, chain=chain)
    except ValueError:
        svg = _error_svg("agentproof", "not found", style)
        return Response(content=svg, media_type="image/svg+xml")

    rec = result.recommendation.value if hasattr(result.recommendation, "value") else str(result.recommendation)
    color = RECOMMENDATION_COLORS.get(rec, "6b7280")

    # Custom recommendation badge
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="180" height="26" role="img" aria-label="AgentProof: {rec}">
  <title>AgentProof: {rec}</title>
  <defs>
    <filter id="g"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="180" height="26" rx="5" fill="#0a0a0f" stroke="#{color}" stroke-width="0.8" stroke-opacity="0.3"/>
  <g transform="translate(6, 3)" filter="url(#g)">
    <g transform="scale(1.25)">
      <path d="{SHIELD_PATH}" fill="none" stroke="#{color}" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="{CHECK_PATH}" fill="none" stroke="#{color}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
  <text x="32" y="16.5" font-family="ui-monospace,SFMono-Regular,Menlo,Monaco,monospace" font-size="9" fill="#8888aa" font-weight="500">AGENTPROOF</text>
  <text x="174" y="16.5" font-family="ui-monospace,SFMono-Regular,Menlo,Monaco,monospace" font-size="9" fill="#{color}" text-anchor="end" font-weight="700">{rec}</text>
</svg>'''

    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=300"},
    )
