"""Scoring engine for the standalone indexer — mirrors backend/app/services/scoring.py"""

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
    Composite score (0-100):
    - Average rating: 40% (Bayesian smoothed)
    - Feedback volume: 15% (log scale)
    - Feedback consistency: 15% (inverse std dev)
    - Validation success rate: 20%
    - Account age: 10% (log scale)
    """
    prior_rating = 50.0
    k = 10
    smoothed_rating = (average_rating * feedback_count + prior_rating * k) / (feedback_count + k)

    rating_score = smoothed_rating

    if feedback_count == 0:
        volume_score = 0.0
    else:
        volume_score = min(100.0, (math.log10(feedback_count + 1) / math.log10(101)) * 100)

    if feedback_count < 2:
        consistency_score = 50.0
    else:
        consistency_score = max(0.0, 100.0 * (1 - rating_std_dev / 50.0))

    validation_score = validation_success_rate

    if account_age_days <= 0:
        age_score = 0.0
    else:
        age_score = min(100.0, (math.log10(account_age_days + 1) / math.log10(366)) * 100)

    composite = (
        rating_score * 0.40
        + volume_score * 0.15
        + consistency_score * 0.15
        + validation_score * 0.20
        + age_score * 0.10
    )

    return round(max(0.0, min(100.0, composite)), 2)


def determine_tier(composite_score: float, feedback_count: int) -> str:
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
    return "unranked"


def calculate_std_dev(ratings: list[int]) -> float:
    if len(ratings) < 2:
        return 0.0
    mean = sum(ratings) / len(ratings)
    variance = sum((r - mean) ** 2 for r in ratings) / len(ratings)
    return math.sqrt(variance)


def calculate_account_age_days(registered_at: datetime) -> int:
    now = datetime.now(timezone.utc)
    if registered_at.tzinfo is None:
        registered_at = registered_at.replace(tzinfo=timezone.utc)
    return max(0, (now - registered_at).days)
