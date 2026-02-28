import math
from datetime import datetime, timezone


def calculate_uri_stability_score(uri_change_count: int) -> float:
    """URI stability score (0-100). Fewer changes = higher score."""
    if uri_change_count == 0:
        return 100.0
    if uri_change_count <= 2:
        return 80.0
    if uri_change_count <= 5:
        return 50.0
    return max(0.0, 100.0 - uri_change_count * 10)


def calculate_freshness_multiplier(account_age_days: int) -> float:
    """Freshness penalty: new identities get a score multiplier < 1.0."""
    if account_age_days < 7:
        return 0.70
    if account_age_days < 30:
        return 0.85
    if account_age_days < 90:
        return 0.95
    return 1.0


def calculate_deployer_score(
    total_agents: int,
    active_agents: int,
    abandoned_agents: int,
    avg_agent_score: float,
    oldest_age_days: int,
) -> float:
    """
    Deployer reputation score (0-100).
    Weights: abandonment_ratio 40%, quality 30%, longevity 20%, volume_bonus 10%.
    Abandoned = agent with no feedback AND age > 30 days.
    """
    # Abandonment ratio (lower is better)
    if total_agents > 0:
        abandon_ratio = abandoned_agents / total_agents
        abandonment_score = max(0.0, 100.0 * (1 - abandon_ratio))
    else:
        abandonment_score = 50.0

    # Quality: avg score of deployer's agents
    quality_score = min(100.0, avg_agent_score)

    # Longevity: how long the deployer has been active
    if oldest_age_days <= 0:
        longevity_score = 0.0
    else:
        longevity_score = min(100.0, (math.log10(oldest_age_days + 1) / math.log10(366)) * 100)

    # Volume bonus: deploying more agents is slightly positive (shows commitment)
    volume_bonus = min(100.0, math.log10(max(1, total_agents) + 1) * 50)

    score = (
        abandonment_score * 0.40
        + quality_score * 0.30
        + longevity_score * 0.20
        + volume_bonus * 0.10
    )
    return round(max(0.0, min(100.0, score)), 2)


def calculate_composite_score(
    average_rating: float,
    feedback_count: int,
    rating_std_dev: float,
    validation_success_rate: float,
    account_age_days: int,
    uptime_pct: float = -1.0,
    deployer_score: float = 50.0,
    uri_change_count: int = 0,
) -> float:
    """
    Composite score (0-100) with 8 signals:
    - Average rating: 30% (Bayesian smoothed)
    - Feedback volume: 10% (log scale)
    - Feedback consistency: 10% (inverse std dev)
    - Validation success rate: 15%
    - Account age: 12% (log scale)
    - Uptime score: 10% (agents without uptime data get neutral 50.0)
    - Deployer reputation: 8%
    - URI stability: 5%

    Post-factor: freshness multiplier penalizes new identities.
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
        volume_score = min(100.0, (math.log10(feedback_count + 1) / math.log10(101)) * 100)

    if feedback_count < 2:
        consistency_score = 50.0
    else:
        max_std = 50.0
        consistency_score = max(0.0, 100.0 * (1 - rating_std_dev / max_std))

    # If no validations exist, use neutral score (don't penalize for missing data)
    validation_score = validation_success_rate if validation_success_rate > 0 else 50.0

    if account_age_days <= 0:
        age_score = 0.0
    else:
        age_score = min(100.0, (math.log10(account_age_days + 1) / math.log10(366)) * 100)

    # Uptime score: if no uptime data (uptime_pct < 0), use neutral 50.0
    if uptime_pct < 0:
        uptime_score = 50.0
    else:
        uptime_score = uptime_pct

    uri_stability_score = calculate_uri_stability_score(uri_change_count)
    freshness = calculate_freshness_multiplier(account_age_days)

    composite = (
        rating_score * 0.30
        + volume_score * 0.10
        + consistency_score * 0.10
        + validation_score * 0.15
        + age_score * 0.12
        + uptime_score * 0.10
        + deployer_score * 0.08
        + uri_stability_score * 0.05
    )

    # Apply freshness penalty
    composite *= freshness

    return round(max(0.0, min(100.0, composite)), 2)


def determine_tier(composite_score: float, feedback_count: int) -> str:
    """Determine agent tier based on composite score and feedback count."""
    if composite_score >= 85 and feedback_count >= 20:
        return "diamond"
    elif composite_score >= 72 and feedback_count >= 10:
        return "platinum"
    elif composite_score >= 58 and feedback_count >= 5:
        return "gold"
    elif composite_score >= 42 and feedback_count >= 3:
        return "silver"
    elif composite_score >= 30 and feedback_count >= 1:
        return "bronze"
    else:
        return "unranked"


def calculate_std_dev(ratings: list[int]) -> float:
    """Calculate standard deviation of a list of ratings."""
    if len(ratings) < 2:
        return 0.0
    mean = sum(ratings) / len(ratings)
    variance = sum((r - mean) ** 2 for r in ratings) / len(ratings)
    return math.sqrt(variance)


def calculate_account_age_days(registered_at: datetime) -> int:
    """Calculate the age of an account in days."""
    now = datetime.now(timezone.utc)
    if registered_at.tzinfo is None:
        registered_at = registered_at.replace(tzinfo=timezone.utc)
    delta = now - registered_at
    return max(0, delta.days)


def calculate_max_exposure(
    composite_score: float,
    feedback_count: int,
    account_age_days: int,
    insurance_stake_usd: float = 0.0,
    validation_success_rate: float = 0.0,
) -> float:
    """Calculate max exposure — dollar-denominated trust ceiling.

    "How much should you trust this agent with?" in USD.

    Formula:
    - Base exposure from score: exponential curve, score 50 = $100, score 90 = $50K
    - Confidence multiplier from feedback volume (log scale, caps at 5x)
    - Age multiplier: <7d = 0.1x, <30d = 0.5x, <90d = 0.8x, else 1.0x
    - Insurance bonus: adds insured amount directly (skin in the game)
    - Validation bonus: high success rate boosts by up to 1.5x
    - Hard cap at $1M for any single agent
    """
    if composite_score < 20 or feedback_count == 0:
        return 0.0

    # Exponential base: score 50 → $100, score 75 → ~$5K, score 90 → ~$50K
    base = 100.0 * math.exp((composite_score - 50) * 0.08)

    # Confidence from feedback volume (log scale, 1 review = 1x, 100 = 3x, 1000 = 5x)
    confidence = min(5.0, 1.0 + math.log10(max(1, feedback_count)))

    # Age discount
    if account_age_days < 7:
        age_mult = 0.1
    elif account_age_days < 30:
        age_mult = 0.5
    elif account_age_days < 90:
        age_mult = 0.8
    else:
        age_mult = 1.0

    # Validation bonus
    val_mult = 1.0 + (validation_success_rate / 100.0) * 0.5 if validation_success_rate > 0 else 1.0

    exposure = base * confidence * age_mult * val_mult

    # Insurance adds directly (staked funds = real skin in the game)
    exposure += insurance_stake_usd

    # Hard cap
    return round(min(1_000_000.0, max(0.0, exposure)), 2)


def calculate_score_trajectory(
    current_score: float,
    score_7d_ago: float | None,
    score_30d_ago: float | None,
) -> dict:
    """Calculate score trajectory with 7-day and 30-day deltas.

    Returns:
        {
            "delta_7d": float | None,
            "delta_30d": float | None,
            "trend": "rising" | "falling" | "stable" | "new"
        }
    """
    delta_7d = round(current_score - score_7d_ago, 2) if score_7d_ago is not None else None
    delta_30d = round(current_score - score_30d_ago, 2) if score_30d_ago is not None else None

    # Determine trend from 7d delta (or 30d if 7d unavailable)
    active_delta = delta_7d if delta_7d is not None else delta_30d
    if active_delta is None:
        trend = "new"
    elif active_delta > 1.0:
        trend = "rising"
    elif active_delta < -1.0:
        trend = "falling"
    else:
        trend = "stable"

    return {
        "delta_7d": delta_7d,
        "delta_30d": delta_30d,
        "trend": trend,
    }
