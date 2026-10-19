from datetime import datetime, timezone, timedelta
from app.algorithm import calculate_sm2_schedule, derive_star_rating

def test_derive_star_rating_tiers():
    """Verify that 1-5 star levels map deterministically to interval and repetition tiers."""
    # 1 Star: Unfamiliar / New / Failed
    assert derive_star_rating(interval_days=0.0, repetitions=0) == 1
    assert derive_star_rating(interval_days=0.5, repetitions=1) == 1
    assert derive_star_rating(interval_days=1.0, repetitions=0) == 1

    # 2 Stars: Learning (1 to 4 days)
    assert derive_star_rating(interval_days=1.0, repetitions=1) == 2
    assert derive_star_rating(interval_days=2.5, repetitions=2) == 2
    assert derive_star_rating(interval_days=4.9, repetitions=3) == 2

    # 3 Stars: Familiar (5 to 14 days)
    assert derive_star_rating(interval_days=5.0, repetitions=2) == 3
    assert derive_star_rating(interval_days=10.0, repetitions=3) == 3
    assert derive_star_rating(interval_days=14.9, repetitions=4) == 3

    # 4 Stars: Proficient (15 to 30 days)
    assert derive_star_rating(interval_days=15.0, repetitions=4) == 4
    assert derive_star_rating(interval_days=25.0, repetitions=5) == 4
    assert derive_star_rating(interval_days=30.0, repetitions=5) == 4

    # 5 Stars: Mastered (> 30 days)
    assert derive_star_rating(interval_days=30.1, repetitions=6) == 5
    assert derive_star_rating(interval_days=60.0, repetitions=7) == 5


def test_sm2_again_rating():
    """Again rating resets repetitions to 0, sets interval to 1 day, and reduces ease factor."""
    res = calculate_sm2_schedule(
        rating="again",
        current_reps=5,
        current_interval=20.0,
        current_ease=2.5,
        current_streak=5
    )
    assert res["grade"] == 1
    assert res["is_correct"] is False
    assert res["repetitions"] == 0
    assert res["interval_days"] == 1.0
    assert res["ease_factor"] == 2.30  # 2.5 - 0.20
    assert res["streak"] == 0
    assert res["star_rating"] == 1


def test_sm2_hard_rating():
    """Hard rating applies a conservative 1.2x multiplier and decreases ease by 0.15."""
    res = calculate_sm2_schedule(
        rating="hard",
        current_reps=2,
        current_interval=10.0,
        current_ease=2.5,
        current_streak=2
    )
    assert res["grade"] == 2
    assert res["is_correct"] is True
    assert res["repetitions"] == 3
    assert res["interval_days"] == 12.0  # 10.0 * 1.2
    assert res["ease_factor"] == 2.35   # 2.5 - 0.15
    assert res["streak"] == 3
    assert res["star_rating"] == 3      # 12 days -> 3 stars


def test_sm2_good_progression():
    """Good rating follows standard SM-2 growth: rep 1 -> 1d, rep 2 -> 6d, rep 3 -> interval * ease."""
    # Step 1: New card (reps=0) rated Good
    s1 = calculate_sm2_schedule(rating="good", current_reps=0, current_interval=0.0, current_ease=2.5)
    assert s1["repetitions"] == 1
    assert s1["interval_days"] == 1.0
    assert s1["star_rating"] == 2

    # Step 2: Rep 1 rated Good
    s2 = calculate_sm2_schedule(rating="good", current_reps=s1["repetitions"], current_interval=s1["interval_days"], current_ease=s1["ease_factor"])
    assert s2["repetitions"] == 2
    assert s2["interval_days"] == 6.0
    assert s2["star_rating"] == 3

    # Step 3: Rep 2 rated Good (6.0 * 2.5 = 15.0 days)
    s3 = calculate_sm2_schedule(rating="good", current_reps=s2["repetitions"], current_interval=s2["interval_days"], current_ease=s2["ease_factor"])
    assert s3["repetitions"] == 3
    assert s3["interval_days"] == 15.0
    assert s3["star_rating"] == 4

    # Step 4: Rep 3 rated Good (15.0 * 2.5 = 37.5 days -> 5★ Mastered)
    s4 = calculate_sm2_schedule(rating="good", current_reps=s3["repetitions"], current_interval=s3["interval_days"], current_ease=s3["ease_factor"])
    assert s4["repetitions"] == 4
    assert s4["interval_days"] == 37.5
    assert s4["star_rating"] == 5


def test_sm2_easy_bonus():
    """Easy rating provides immediate interval bonus and increases ease factor."""
    res = calculate_sm2_schedule(
        rating="easy",
        current_reps=2,
        current_interval=10.0,
        current_ease=2.5,
        current_streak=2
    )
    assert res["grade"] == 4
    assert res["is_correct"] is True
    assert res["repetitions"] == 3
    # 10.0 * 2.5 * 1.3 = 32.5 days -> graduates directly to 5★ Mastered
    assert res["interval_days"] == 32.5
    assert res["ease_factor"] == 2.65  # 2.5 + 0.15
    assert res["star_rating"] == 5


def test_ease_factor_minimum_floor():
    """Ease factor must never drop below the standard SM-2 floor of 1.3."""
    res = calculate_sm2_schedule(
        rating="again",
        current_reps=1,
        current_interval=5.0,
        current_ease=1.35
    )
    assert res["ease_factor"] == 1.3  # clamped at 1.3
