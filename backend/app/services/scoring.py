import math
from datetime import datetime, timezone


def calculate_composite_score(
    average_rating: float,
    feedback_count: int,
    rating_std_dev: float,
    validation_success_rate: float,
    account_age_days: int,
) -> float:
    """
    Composite score (0-100) based on:
    - Average rating: 40% weight
    - Feedback volume: 15% weight (logarithmic scale)
    - Feedback consistency: 15% weight (lower std dev = more consistent)
    - Validation success rate: 20% weight
    - Account age: 10% weight (logarithmic decay)

    Applies Bayesian smoothing to prevent new agents with 1x 100-rating
    from topping the leaderboard (prior of 50 with k=10 pseudo-observations).
    """
    # Bayesian smoothed average rating
    prior_rating = 50.0
    k = 10  # pseudo-observations
    smoothed_rating = (
        (average_rating * feedback_count + prior_rating * k) / (feedback_count + k)
    )

    # 1. Rating component (40%) - smoothed rating normalized to 0-100
    rating_score = smoothed_rating

    # 2. Volume component (15%) - logarithmic scale, caps at ~100 feedback
    if feedback_count == 0:
        volume_score = 0.0
    else:
        volume_score = min(100.0, (math.log10(feedback_count + 1) / math.log10(101)) * 100)

    # 3. Consistency component (15%) - lower std dev = higher score
    # Max std dev on 1-100 scale is ~50. Normalize inversely.
    if feedback_count < 2:
        consistency_score = 50.0  # Neutral for insufficient data
    else:
        max_std = 50.0
        consistency_score = max(0.0, 100.0 * (1 - rating_std_dev / max_std))

    # 4. Validation success rate (20%) - direct percentage
    validation_score = validation_success_rate

    # 5. Account age (10%) - logarithmic, caps at ~365 days
    if account_age_days <= 0:
        age_score = 0.0
    else:
        age_score = min(100.0, (math.log10(account_age_days + 1) / math.log10(366)) * 100)

    # Weighted composite
    composite = (
        rating_score * 0.40
        + volume_score * 0.15
        + consistency_score * 0.15
        + validation_score * 0.20
        + age_score * 0.10
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
