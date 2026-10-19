from datetime import datetime, timezone
from typing import Dict, Any
from fastapi import APIRouter, Depends, Body, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, UserSettings, UserProgress, ReviewLog
from app.auth import get_current_user_optional, get_current_user_required
from app.schemas import UserSettingsOut, UserSettingsUpdate, MessageResponse

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("", response_model=UserSettingsOut)
def get_user_settings(
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Returns the current user's study and display settings."""
    settings = db.query(UserSettings).filter_by(user_id=user.id).first()
    if not settings:
        settings = UserSettings(user_id=user.id, daily_goal=20, furigana_mode="always")
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return UserSettingsOut.model_validate(settings)


@router.put("", response_model=UserSettingsOut)
def update_user_settings(
    payload: UserSettingsUpdate,
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Updates the user's daily study goal, furigana display, audio autoplay, or theme."""
    settings = db.query(UserSettings).filter_by(user_id=user.id).first()
    if not settings:
        settings = UserSettings(user_id=user.id)
        db.add(settings)

    if payload.daily_goal is not None:
        settings.daily_goal = payload.daily_goal
    if payload.furigana_mode is not None:
        if payload.furigana_mode in ("always", "hover", "off"):
            settings.furigana_mode = payload.furigana_mode
    if payload.audio_autoplay is not None:
        settings.audio_autoplay = payload.audio_autoplay
    if payload.theme is not None:
        settings.theme = payload.theme

    db.commit()
    db.refresh(settings)
    return UserSettingsOut.model_validate(settings)


@router.get("/export")
def export_user_data(
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Exports the user's complete learning profile, settings, vocabulary progress,
    and review logs as a portable JSON backup.
    """
    settings = db.query(UserSettings).filter_by(user_id=user.id).first()
    progs = db.query(UserProgress).filter_by(user_id=user.id).all()
    logs = db.query(ReviewLog).filter_by(user_id=user.id).all()

    progress_data = []
    for p in progs:
        progress_data.append({
            "word_id": p.word_id,
            "is_in_review": p.is_in_review,
            "star_rating": p.star_rating,
            "repetitions": p.repetitions,
            "interval_days": p.interval_days,
            "ease_factor": p.ease_factor,
            "next_review_due": p.next_review_due.isoformat() if p.next_review_due else None,
            "last_reviewed_at": p.last_reviewed_at.isoformat() if p.last_reviewed_at else None,
            "total_attempts": p.total_attempts,
            "correct_attempts": p.correct_attempts,
            "streak": p.streak,
            "user_notes": p.user_notes
        })

    logs_data = []
    for l in logs:
        logs_data.append({
            "word_id": l.word_id,
            "rating": l.rating,
            "grade": l.grade,
            "stars_before": l.stars_before,
            "stars_after": l.stars_after,
            "interval_after": l.interval_after,
            "reviewed_at": l.reviewed_at.isoformat()
        })

    return {
        "version": "1.0",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_guest": user.is_guest
        },
        "settings": {
            "daily_goal": settings.daily_goal if settings else 20,
            "furigana_mode": settings.furigana_mode if settings else "always",
            "audio_autoplay": settings.audio_autoplay if settings else True,
            "theme": settings.theme if settings else "dark"
        },
        "progress_count": len(progress_data),
        "review_logs_count": len(logs_data),
        "progress": progress_data,
        "logs": logs_data
    }


@router.post("/import", response_model=MessageResponse)
def import_user_data(
    payload: dict = Body(...),
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Restores learning progress from a valid Kotoba Master JSON backup file.
    """
    progress_items = payload.get("progress", [])
    imported_count = 0

    for item in progress_items:
        word_id = item.get("word_id")
        if not word_id:
            continue

        prog = db.query(UserProgress).filter_by(user_id=user.id, word_id=word_id).first()
        if not prog:
            prog = UserProgress(user_id=user.id, word_id=word_id)
            db.add(prog)

        prog.is_in_review = item.get("is_in_review", True)
        prog.star_rating = item.get("star_rating", 1)
        prog.repetitions = item.get("repetitions", 0)
        prog.interval_days = float(item.get("interval_days", 0.0))
        prog.ease_factor = float(item.get("ease_factor", 2.5))
        prog.streak = item.get("streak", 0)
        prog.total_attempts = item.get("total_attempts", 0)
        prog.correct_attempts = item.get("correct_attempts", 0)
        if item.get("user_notes"):
            prog.user_notes = item.get("user_notes")

        if item.get("next_review_due"):
            try:
                prog.next_review_due = datetime.fromisoformat(item["next_review_due"])
            except Exception:
                pass

        imported_count += 1

    # Restore settings if present
    settings_data = payload.get("settings")
    if settings_data:
        st = db.query(UserSettings).filter_by(user_id=user.id).first()
        if not st:
            st = UserSettings(user_id=user.id)
            db.add(st)
        if "daily_goal" in settings_data:
            st.daily_goal = settings_data["daily_goal"]
        if "furigana_mode" in settings_data:
            st.furigana_mode = settings_data["furigana_mode"]
        if "theme" in settings_data:
            st.theme = settings_data["theme"]

    db.commit()
    return MessageResponse(
        message=f"Successfully imported progress for {imported_count} words!",
        success=True
    )
