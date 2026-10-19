from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, cast, Date
from app.database import get_db
from app.models import Word, UserProgress, ReviewLog, User
from app.auth import get_current_user_optional
from app.schemas import StatsResponse, HeatmapItem, DueForecastItem

router = APIRouter(prefix="/stats", tags=["Stats"])

@router.get("", response_model=StatsResponse)
def get_user_stats(
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Computes comprehensive learning analytics for the current user:
    - 5-Star mastery breakdown
    - Daily activity heatmap (past 365 days)
    - 30-day accuracy trend
    - 14-day upcoming due card forecast
    - Current and longest study day streaks
    """
    now = datetime.now(timezone.utc)
    today = now.date()

    # 1. High-level counts
    total_words = db.query(func.count(Word.id)).scalar() or 0

    user_progs = db.query(UserProgress).filter(UserProgress.user_id == user.id).all()
    words_in_review = sum(1 for p in user_progs if p.is_in_review)
    mastered_count = sum(1 for p in user_progs if p.star_rating == 5)

    star_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for p in user_progs:
        star_distribution[p.star_rating] = star_distribution.get(p.star_rating, 0) + 1

    # 2. Review logs analytics
    logs = db.query(ReviewLog).filter(ReviewLog.user_id == user.id).order_by(ReviewLog.reviewed_at.asc()).all()
    total_reviews_done = len(logs)
    correct_reviews = sum(1 for l in logs if l.grade > 1)
    overall_accuracy = round((correct_reviews / total_reviews_done) * 100, 1) if total_reviews_done > 0 else 0.0

    # 3. Calculate Streaks & Heatmap
    daily_stats: Dict[str, Dict[str, Any]] = {}
    activity_dates = set()

    for l in logs:
        d_str = l.reviewed_at.strftime("%Y-%m-%d")
        activity_dates.add(l.reviewed_at.date())
        if d_str not in daily_stats:
            daily_stats[d_str] = {"count": 0, "correct": 0}
        daily_stats[d_str]["count"] += 1
        if l.grade > 1:
            daily_stats[d_str]["correct"] += 1

    heatmap: List[HeatmapItem] = []
    # Generate past 365 days
    for i in range(365, -1, -1):
        dt = (today - timedelta(days=i)).isoformat()
        st = daily_stats.get(dt)
        if st:
            acc = round((st["correct"] / st["count"]) * 100, 1) if st["count"] > 0 else 0.0
            heatmap.append(HeatmapItem(date=dt, count=st["count"], accuracy=acc))
        else:
            heatmap.append(HeatmapItem(date=dt, count=0, accuracy=0.0))

    # Calculate Current & Longest Streak
    current_streak = 0
    longest_streak = 0

    if activity_dates:
        # Check current streak
        check_date = today
        if check_date not in activity_dates:
            check_date = today - timedelta(days=1)

        while check_date in activity_dates:
            current_streak += 1
            check_date -= timedelta(days=1)

        # Calculate longest streak
        sorted_dates = sorted(list(activity_dates))
        temp_streak = 1
        longest_streak = 1
        for i in range(1, len(sorted_dates)):
            if sorted_dates[i] == sorted_dates[i - 1] + timedelta(days=1):
                temp_streak += 1
                if temp_streak > longest_streak:
                    longest_streak = temp_streak
            else:
                temp_streak = 1
    else:
        current_streak = 0
        longest_streak = 0

    # 4. Accuracy Trend (Last 30 days)
    accuracy_trend = []
    for i in range(29, -1, -1):
        dt = (today - timedelta(days=i)).isoformat()
        st = daily_stats.get(dt)
        if st:
            acc = round((st["correct"] / st["count"]) * 100, 1)
            accuracy_trend.append({"date": dt, "accuracy": acc, "reviews": st["count"]})
        else:
            accuracy_trend.append({"date": dt, "accuracy": None, "reviews": 0})

    # 5. Due Forecast (Next 14 Days)
    due_forecast: List[DueForecastItem] = []
    cumulative = 0
    for i in range(14):
        target_day = today + timedelta(days=i)
        target_str = target_day.isoformat()

        # Count cards due on this day
        day_due = 0
        for p in user_progs:
            if p.is_in_review and p.next_review_due:
                if p.next_review_due.date() == target_day:
                    day_due += 1
                elif i == 0 and p.next_review_due.date() < target_day:
                    day_due += 1  # Add overdue items to today's count

        cumulative += day_due
        due_forecast.append(DueForecastItem(date=target_str, due_count=day_due, cumulative_due=cumulative))

    return StatsResponse(
        total_words=total_words,
        words_in_review=words_in_review,
        mastered_count=mastered_count,
        overall_accuracy=overall_accuracy,
        total_reviews_done=total_reviews_done,
        current_streak=current_streak,
        longest_streak=longest_streak,
        star_distribution=star_distribution,
        heatmap=heatmap,
        accuracy_trend=accuracy_trend,
        due_forecast=due_forecast
    )
