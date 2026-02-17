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
