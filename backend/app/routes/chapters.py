from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Word, UserProgress, ChapterProgress
from app.schemas import ChapterOut, WordOut, ToggleReviewRequest, ToggleReviewResponse

router = APIRouter(prefix="/chapters", tags=["Chapters & Lessons"])

MASTERY_THRESHOLD_PERCENT = 75.0  # 75% star mastery unlocks next chapter

def calculate_chapter_mastery(db: Session, lesson_number: int) -> float:
    """
    Computes chapter mastery percentage: (total stars earned) / (total words * 5) * 100.
    """
    words = db.query(Word.id).filter(Word.lesson_number == lesson_number).all()
    if not words:
        return 0.0

    word_ids = [w[0] for w in words]
    total_stars = db.query(func.sum(UserProgress.star_rating)).filter(
        UserProgress.word_id.in_(word_ids)
    ).scalar() or 0

    max_possible_stars = len(word_ids) * 5
    return round((total_stars / max_possible_stars) * 100, 1)


@router.get("", response_model=List[ChapterOut])
def list_chapters(db: Session = Depends(get_db)):
    """
    Lists all 25 Minna no Nihongo chapters with unlock status and live mastery %.
    """
    chapters = db.query(ChapterProgress).order_by(ChapterProgress.lesson_number).all()
    out = []

    for chap in chapters:
        words = db.query(Word).filter(Word.lesson_number == chap.lesson_number).all()
        total_words = len(words)
        
        words_in_review = 0
        if total_words > 0:
            word_ids = [w.id for w in words]
            words_in_review = db.query(UserProgress).filter(
                UserProgress.word_id.in_(word_ids),
                UserProgress.is_in_review == True
            ).count()

        mastery_pct = calculate_chapter_mastery(db, chap.lesson_number)
        can_unlock = (mastery_pct >= MASTERY_THRESHOLD_PERCENT)

        out.append(ChapterOut(
            lesson_number=chap.lesson_number,
            title=chap.title,
            description=chap.description,
            is_unlocked=chap.is_unlocked,
            total_words=total_words,
            words_in_review=words_in_review,
            mastery_percentage=mastery_pct,
            can_unlock=can_unlock
        ))
    return out


@router.get("/{lesson_number}/words", response_model=List[WordOut])
def get_chapter_words(lesson_number: int, db: Session = Depends(get_db)):
    """
    Returns all vocabulary words for a given Minna no Nihongo lesson.
    """
    chap = db.query(ChapterProgress).filter_by(lesson_number=lesson_number).first()
    if not chap:
        raise HTTPException(status_code=404, detail="Chapter not found.")

    words = db.query(Word).filter(Word.lesson_number == lesson_number).order_by(Word.id).all()
    return words


@router.post("/{lesson_number}/add-all-to-review")
def add_all_chapter_words_to_review(lesson_number: int, db: Session = Depends(get_db)):
    """
    Batch adds all words from this chapter into the active review queue.
    """
    chap = db.query(ChapterProgress).filter_by(lesson_number=lesson_number).first()
    if not chap or not chap.is_unlocked:
        raise HTTPException(status_code=400, detail="Chapter is locked or does not exist.")

    word_ids = [w.id for w in db.query(Word.id).filter(Word.lesson_number == lesson_number).all()]
    if not word_ids:
        return {"status": "ok", "added_count": 0}

    updated = db.query(UserProgress).filter(UserProgress.word_id.in_(word_ids)).update({
        UserProgress.is_in_review: True,
        UserProgress.learned_at: datetime.now(timezone.utc)
    }, synchronize_session=False)

    db.commit()
    return {"status": "ok", "lesson_number": lesson_number, "added_count": updated}


@router.post("/toggle-review", response_model=ToggleReviewResponse)
def toggle_word_review(payload: ToggleReviewRequest, db: Session = Depends(get_db)):
    """
    Toggles an individual vocabulary word in/out of the active review queue.
    """
    progress = db.query(UserProgress).filter_by(word_id=payload.word_id).first()
    if not progress:
        raise HTTPException(status_code=404, detail="Word progress not found.")

    progress.is_in_review = payload.is_in_review
    if payload.is_in_review and not progress.learned_at:
        progress.learned_at = datetime.now(timezone.utc)

    db.commit()
    status_str = "added to review" if payload.is_in_review else "removed from review"
    return ToggleReviewResponse(
        word_id=payload.word_id,
        is_in_review=payload.is_in_review,
        message=f"Word successfully {status_str}."
    )


@router.post("/{lesson_number}/check-unlock")
def check_and_unlock_next_chapter(lesson_number: int, db: Session = Depends(get_db)):
    """
    Checks if chapter has met the 75% mastery threshold and unlocks the next chapter.
    """
    mastery_pct = calculate_chapter_mastery(db, lesson_number)
    next_lesson_number = lesson_number + 1

    next_chap = db.query(ChapterProgress).filter_by(lesson_number=next_lesson_number).first()
    if not next_chap:
        return {"status": "no_next_chapter", "mastery_percentage": mastery_pct}

    unlocked_now = False
    if mastery_pct >= MASTERY_THRESHOLD_PERCENT and not next_chap.is_unlocked:
        next_chap.is_unlocked = True
        next_chap.unlocked_at = datetime.now(timezone.utc)
        db.commit()
        unlocked_now = True

    return {
        "current_lesson": lesson_number,
        "mastery_percentage": mastery_pct,
        "threshold_required": MASTERY_THRESHOLD_PERCENT,
        "next_lesson_unlocked": next_chap.is_unlocked,
        "newly_unlocked": unlocked_now
    }
