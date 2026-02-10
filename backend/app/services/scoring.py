import math
from datetime import datetime, timezone


def calculate_composite_score(
    average_rating: float,
    feedback_count: int,
    rating_std_dev: float,
    validation_success_rate: float,
    account_age_days: int,
    uptime_pct: float = -1.0,
) -> float:
    """
    Composite score (0-100) with 6 signals:
    - Average rating: 35% (Bayesian smoothed)
    - Feedback volume: 12% (log scale)
    - Feedback consistency: 13% (inverse std dev)
    - Validation success rate: 18%
    - Account age: 7% (log scale)
    - Uptime score: 15% (agents without uptime data get neutral 50.0)

    Applies Bayesian smoothing to prevent new agents with 1x 100-rating
    from topping the leaderboard (prior of 50 with k=10 pseudo-observations).
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

    validation_score = validation_success_rate

    if account_age_days <= 0:
        age_score = 0.0
    else:
        age_score = min(100.0, (math.log10(account_age_days + 1) / math.log10(366)) * 100)

    # Uptime score: if no uptime data (uptime_pct < 0), use neutral 50.0
    if uptime_pct < 0:
        uptime_score = 50.0
    else:
        uptime_score = uptime_pct

    composite = (
        rating_score * 0.35
        + volume_score * 0.12
        + consistency_score * 0.13
        + validation_score * 0.18
        + age_score * 0.07
        + uptime_score * 0.15
    )

    return round(max(0.0, min(100.0, composite)), 2)


def determine_tier(composite_score: float, feedback_count: int) -> str:
    """Determine agent tier based on composite score and feedback count."""
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
