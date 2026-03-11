"""SVG badge endpoints — embeddable trust badges for GitHub READMEs, docs, and websites.

Usage:
  ![AgentProof](https://oracle.agentproof.sh/api/v1/badge/1380.svg)
  ![AgentProof](https://oracle.agentproof.sh/api/v1/badge/1380.svg?style=flat-square)
  ![AgentProof](https://oracle.agentproof.sh/api/v1/badge/1380.svg?label=trust)
"""

import logging
from fastapi import APIRouter, HTTPException, Query
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

RECOMMENDATION_COLORS = {
    "TRUSTED": "00ff88",
    "CAUTION": "ffaa00",
    "HIGH_RISK": "ff3344",
    "UNVERIFIED": "6b7280",
}

# ── SVG templates ────────────────────────────────────────────

def _shield_svg(label: str, value: str, color: str, style: str = "flat") -> str:
    """Generate a shields.io-style SVG badge."""
    # Estimate text widths (approximation: 6.5px per char at 11px font)
    label_width = max(len(label) * 6.5 + 12, 40)
    value_width = max(len(value) * 7 + 12, 36)
    total_width = label_width + value_width
    label_x = label_width / 2
    value_x = label_width + value_width / 2

    if style == "flat-square":
        return _flat_square_svg(label, value, color, total_width, label_width, value_width, label_x, value_x)
    elif style == "for-the-badge":
        return _for_the_badge_svg(label, value, color, total_width, label_width, value_width, label_x, value_x)
    else:
        return _flat_svg(label, value, color, total_width, label_width, value_width, label_x, value_x)


def _flat_svg(label, value, color, w, lw, vw, lx, vx):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w:.0f}" height="20" role="img" aria-label="{label}: {value}">
  <title>{label}: {value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="{w:.0f}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="{lw:.0f}" height="20" fill="#555"/>
    <rect x="{lw:.0f}" width="{vw:.0f}" height="20" fill="#{color}"/>
    <rect width="{w:.0f}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="{lx:.0f}" y="15" fill="#010101" fill-opacity=".3">{label}</text>
    <text x="{lx:.0f}" y="14">{label}</text>
    <text aria-hidden="true" x="{vx:.0f}" y="15" fill="#010101" fill-opacity=".3">{value}</text>
    <text x="{vx:.0f}" y="14">{value}</text>
  </g>
</svg>'''


def _flat_square_svg(label, value, color, w, lw, vw, lx, vx):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w:.0f}" height="20" role="img" aria-label="{label}: {value}">
  <title>{label}: {value}</title>
  <g shape-rendering="crispEdges">
    <rect width="{lw:.0f}" height="20" fill="#555"/>
    <rect x="{lw:.0f}" width="{vw:.0f}" height="20" fill="#{color}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="{lx:.0f}" y="14">{label}</text>
    <text x="{vx:.0f}" y="14">{value}</text>
  </g>
</svg>'''


def _for_the_badge_svg(label, value, color, w, lw, vw, lx, vx):
    # Wider, taller badge
    scale = 1.4
    tw = w * scale
    tlw = lw * scale
    tvw = vw * scale
    tlx = tlw / 2
    tvx = tlw + tvw / 2
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{tw:.0f}" height="28" role="img" aria-label="{label}: {value}">
  <title>{label}: {value}</title>
  <g shape-rendering="crispEdges">
    <rect width="{tlw:.0f}" height="28" fill="#555"/>
    <rect x="{tlw:.0f}" width="{tvw:.0f}" height="28" fill="#{color}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="10">
    <text transform="scale(1.1)" x="{tlx / 1.1:.0f}" y="18" textLength="{tlw * 0.7:.0f}" lengthAdjust="spacing">{label.upper()}</text>
    <text transform="scale(1.1)" x="{tvx / 1.1:.0f}" y="18" textLength="{tvw * 0.7:.0f}" lengthAdjust="spacing" font-weight="bold">{value}</text>
  </g>
</svg>'''


# ── Endpoints ────────────────────────────────────────────────

@router.get("/{agent_id}.svg")
async def badge_score(
    agent_id: int,
    style: str = Query("flat", description="Badge style", enum=["flat", "flat-square", "for-the-badge"]),
    label: str = Query("agentproof", description="Left-side label text"),
    chain: str | None = Query(None, description="Source chain"),
):
    """SVG badge showing agent trust score and tier.

    Embed in markdown:
    ```
    ![AgentProof](https://oracle.agentproof.sh/api/v1/badge/1380.svg)
    ```
    """
    cache = get_trust_cache()
    cache_key = f"badge:{agent_id}:{chain}:{style}:{label}"
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
        # Return a "not found" badge instead of 404 — so embeds don't break
        svg = _shield_svg(label, "not found", "e05d44", style)
        return Response(
            content=svg,
            media_type="image/svg+xml",
            headers={"Cache-Control": "public, max-age=60"},
        )
    except Exception as e:
        logger.error(f"Badge error for agent #{agent_id}: {e}")
        svg = _shield_svg(label, "error", "e05d44", style)
        return Response(content=svg, media_type="image/svg+xml")

    color = TIER_COLORS.get(result.tier, "6b7280")
    value = f"{result.tier} · {result.composite_score:.1f}"
    svg = _shield_svg(label, value, color, style)

    cache.set(cache_key, svg, ttl=300)
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=300", "X-Cache": "MISS"},
    )


@router.get("/tier/{agent_id}.svg")
async def badge_tier(
    agent_id: int,
    style: str = Query("flat", enum=["flat", "flat-square", "for-the-badge"]),
    chain: str | None = Query(None),
):
    """SVG badge showing tier only."""
    try:
        svc = get_trust_service()
        result = svc.evaluate_agent(agent_id, chain=chain)
    except ValueError:
        svg = _shield_svg("agentproof", "not found", "e05d44", style)
        return Response(content=svg, media_type="image/svg+xml")

    color = TIER_COLORS.get(result.tier, "6b7280")
    svg = _shield_svg("trust tier", result.tier.upper(), color, style)
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=300"},
    )


@router.get("/score/{agent_id}.svg")
async def badge_score_only(
    agent_id: int,
    style: str = Query("flat", enum=["flat", "flat-square", "for-the-badge"]),
    chain: str | None = Query(None),
):
    """SVG badge showing numeric score only."""
    try:
        svc = get_trust_service()
        result = svc.evaluate_agent(agent_id, chain=chain)
    except ValueError:
        svg = _shield_svg("trust score", "N/A", "e05d44", style)
        return Response(content=svg, media_type="image/svg+xml")

    color = TIER_COLORS.get(result.tier, "6b7280")
    svg = _shield_svg("trust score", f"{result.composite_score:.1f}/100", color, style)
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=300"},
    )


@router.get("/recommendation/{agent_id}.svg")
async def badge_recommendation(
    agent_id: int,
    style: str = Query("flat", enum=["flat", "flat-square", "for-the-badge"]),
    chain: str | None = Query(None),
):
    """SVG badge showing recommendation (TRUSTED / CAUTION / HIGH_RISK)."""
    try:
        svc = get_trust_service()
        result = svc.evaluate_agent(agent_id, chain=chain)
    except ValueError:
        svg = _shield_svg("agentproof", "not found", "e05d44", style)
        return Response(content=svg, media_type="image/svg+xml")

    rec = result.recommendation.value if hasattr(result.recommendation, "value") else str(result.recommendation)
    color = RECOMMENDATION_COLORS.get(rec, "6b7280")
    svg = _shield_svg("agentproof", rec, color, style)
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=300"},
    )
