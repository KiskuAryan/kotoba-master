from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Word, UserProgress, ChapterProgress, User
from app.auth import get_current_user_optional
from app.schemas import ChapterOut, WordOut, ProgressOut, ToggleReviewRequest, ToggleReviewResponse
from app.routes.auth import init_user_chapters

router = APIRouter(prefix="/chapters", tags=["Chapters & Lessons"])

MASTERY_THRESHOLD_PERCENT = 70.0  # 70% star mastery in previous lesson unlocks next lesson

def calculate_chapter_mastery(db: Session, lesson_number: int, user_id: int = 1) -> float:
    """
    Computes chapter mastery percentage for a specific user:
    (total stars earned) / (total words * 5) * 100.
    """
    words = db.query(Word.id).filter(Word.lesson_number == lesson_number).all()
    if not words:
        return 0.0

    word_ids = [w[0] for w in words]
    total_stars = db.query(func.sum(UserProgress.star_rating)).filter(
        UserProgress.user_id == user_id,
        UserProgress.word_id.in_(word_ids)
    ).scalar() or 0

    max_possible_stars = len(word_ids) * 5
    return round((total_stars / max_possible_stars) * 100, 1)


@router.get("", response_model=List[ChapterOut])
def list_chapters(
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Lists all 25 Minna no Nihongo chapters with AHA Lab style progression:
    Lesson 1 unlocked by default; Lesson N unlocks once Lesson N-1 reaches 70% mastery.
    """
    chapters = db.query(ChapterProgress).filter_by(user_id=user.id).order_by(ChapterProgress.lesson_number).all()
    if not chapters:
        init_user_chapters(db, user.id)
        chapters = db.query(ChapterProgress).filter_by(user_id=user.id).order_by(ChapterProgress.lesson_number).all()

    # Precompute masteries to evaluate progression
    masteries = {}
    for chap in chapters:
        masteries[chap.lesson_number] = calculate_chapter_mastery(db, chap.lesson_number, user_id=user.id)

    out = []
    now = datetime.now(timezone.utc)
    for chap in chapters:
        words = db.query(Word).filter(Word.lesson_number == chap.lesson_number).all()
        total_words = len(words)
        
        words_in_review = 0
        if total_words > 0:
            word_ids = [w.id for w in words]
            words_in_review = db.query(UserProgress).filter(
                UserProgress.user_id == user.id,
                UserProgress.word_id.in_(word_ids),
                UserProgress.is_in_review == True
            ).count()

        mastery_pct = masteries[chap.lesson_number]
        prev_mastery = masteries.get(chap.lesson_number - 1, 100.0) if chap.lesson_number > 1 else None

        # Check progression: Lesson 1 always unlocked; Lesson N unlocked if Lesson N-1 >= 70%
        can_unlock = (chap.lesson_number == 1) or (prev_mastery is not None and prev_mastery >= MASTERY_THRESHOLD_PERCENT)
        
        if can_unlock and not chap.is_unlocked:
            chap.is_unlocked = True
            chap.unlocked_at = now
            db.commit()

        out.append(ChapterOut(
            lesson_number=chap.lesson_number,
            title=chap.title,
            description=chap.description,
            is_unlocked=chap.is_unlocked,
            total_words=total_words,
            words_in_review=words_in_review,
            mastery_percentage=mastery_pct,
            can_unlock=can_unlock,
            required_mastery=MASTERY_THRESHOLD_PERCENT,
            prev_lesson_mastery=prev_mastery
        ))
    return out


@router.get("/{lesson_number}/words", response_model=List[WordOut])
def get_chapter_words(
    lesson_number: int,
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Returns all vocabulary words for a given lesson, populated with the current user's progress.
    """
    chap = db.query(ChapterProgress).filter_by(user_id=user.id, lesson_number=lesson_number).first()
    if not chap:
        chap = db.query(ChapterProgress).filter_by(lesson_number=lesson_number).first()
    if not chap:
        raise HTTPException(status_code=404, detail="Chapter not found.")

    if lesson_number > 1 and not chap.is_unlocked:
        prev_mastery = calculate_chapter_mastery(db, lesson_number - 1, user_id=user.id)
        if prev_mastery >= MASTERY_THRESHOLD_PERCENT:
            chap.is_unlocked = True
            chap.unlocked_at = datetime.now(timezone.utc)
            db.commit()
        else:
            raise HTTPException(
                status_code=403,
                detail=f"Lesson {lesson_number} is locked! Master Lesson {lesson_number - 1} to at least {int(MASTERY_THRESHOLD_PERCENT)}% to unlock."
            )

    words = db.query(Word).filter(Word.lesson_number == lesson_number).order_by(Word.id).all()
    out = []
    for w in words:
        up = db.query(UserProgress).filter_by(user_id=user.id, word_id=w.id).first()
        if not up:
            up = UserProgress(user_id=user.id, word_id=w.id, star_rating=1, is_in_review=False)
            db.add(up)
            db.flush()

        word_dict = {
            "id": w.id,
            "lesson_number": w.lesson_number,
            "book_title": w.book_title,
            "kanji": w.kanji,
            "kana": w.kana,
            "romaji": w.romaji,
            "meaning": w.meaning,
            "jlpt_level": w.jlpt_level,
            "level": w.jlpt_level,
            "part_of_speech": w.part_of_speech,
            "example_ja": w.example_ja,
            "example_en": w.example_en,
            "example_sentence": w.example_ja,
            "example_translation": w.example_en,
            "mnemonic": w.mnemonic,
            "stars": up.star_rating if up else 1,
            "is_in_review": up.is_in_review if up else False,
            "user_notes": up.user_notes if up else "",
            "progress": ProgressOut.model_validate(up)
        }
        out.append(WordOut.model_validate(word_dict))

    db.commit()
    return out


@router.post("/{lesson_number}/add-all-to-review")
def add_all_chapter_words_to_review(
    lesson_number: int,
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Batch adds all words from this chapter into the active review queue for this user.
    """
    chap = db.query(ChapterProgress).filter_by(user_id=user.id, lesson_number=lesson_number).first()
    now = datetime.now(timezone.utc)
    if not chap:
        chap = ChapterProgress(user_id=user.id, lesson_number=lesson_number, title=f"Lesson {lesson_number}", is_unlocked=(lesson_number == 1), unlocked_at=now if lesson_number == 1 else None)
        db.add(chap)
        db.flush()

    if lesson_number > 1 and not chap.is_unlocked:
        prev_mastery = calculate_chapter_mastery(db, lesson_number - 1, user_id=user.id)
        if prev_mastery < MASTERY_THRESHOLD_PERCENT:
            raise HTTPException(
                status_code=403,
                detail=f"Lesson {lesson_number} is locked! Master Lesson {lesson_number - 1} to at least {int(MASTERY_THRESHOLD_PERCENT)}% first (Current: {prev_mastery}%)."
            )
        chap.is_unlocked = True
        chap.unlocked_at = now

    words = db.query(Word.id).filter(Word.lesson_number == lesson_number).all()
    word_ids = [w[0] for w in words]
    if not word_ids:
        return {"status": "ok", "added_count": 0}

    added_count = 0
    for wid in word_ids:
        up = db.query(UserProgress).filter_by(user_id=user.id, word_id=wid).first()
        if not up:
            up = UserProgress(user_id=user.id, word_id=wid, star_rating=1, is_in_review=True, learned_at=now, next_review_due=now)
            db.add(up)
            added_count += 1
        else:
            up.is_in_review = True
            if not up.learned_at:
                up.learned_at = now
            if not up.next_review_due:
                up.next_review_due = now
            added_count += 1

    db.commit()
    return {"status": "ok", "lesson_number": lesson_number, "added_count": added_count}


@router.post("/toggle-review", response_model=ToggleReviewResponse)
def toggle_word_review(
    payload: ToggleReviewRequest,
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Toggles an individual vocabulary word in/out of the active review queue for this user.
    """
    progress = db.query(UserProgress).filter_by(user_id=user.id, word_id=payload.word_id).first()
    if not progress:
        progress = UserProgress(
            user_id=user.id,
            word_id=payload.word_id,
            star_rating=1,
            is_in_review=payload.is_in_review,
            learned_at=datetime.now(timezone.utc) if payload.is_in_review else None
        )
        db.add(progress)
    else:
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
def check_and_unlock_next_chapter(
    lesson_number: int,
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Checks if chapter has met the 75% mastery threshold and unlocks the next chapter for this user.
    """
    mastery_pct = calculate_chapter_mastery(db, lesson_number, user_id=user.id)
    next_lesson_number = lesson_number + 1

    next_chap = db.query(ChapterProgress).filter_by(user_id=user.id, lesson_number=next_lesson_number).first()
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
