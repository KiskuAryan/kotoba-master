from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models import Word, UserProgress, ReviewLog, User
from app.auth import get_current_user_optional, get_current_user_required
from app.schemas import ReviewDueItem, ReviewSubmitRequest, ReviewSubmitResponse
from app.algorithm import calculate_sm2_schedule, get_due_words_for_user, generate_mcq_options

router = APIRouter(prefix="/reviews", tags=["Reviews"])

@router.get("/due")
def get_due_reviews(
    deck_id: Optional[int] = Query(None, description="Optional deck filter"),
    limit: int = Query(20, ge=1, le=100, description="Max session cards"),
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Returns items currently due for review according to SM-2 scheduling,
    prioritizing overdue items and new cards in the queue, populated with 4-choice MCQ options.
    """
    now = datetime.now(timezone.utc)

    # 1. Fetch due items (is_in_review == True AND (next_review_due is None OR next_review_due <= now))
    due_pairs = get_due_words_for_user(db, user_id=user.id, deck_id=deck_id, limit=limit)

    # Total counts for lobby metrics
    queue_query = db.query(UserProgress).filter(
        UserProgress.user_id == user.id,
        UserProgress.is_in_review == True
    )
    if deck_id is not None:
        queue_query = queue_query.join(Word, Word.id == UserProgress.word_id).filter(Word.deck_id == deck_id)

    total_in_queue = queue_query.count()

    due_query = queue_query.filter(
        or_(
            UserProgress.next_review_due == None,
            UserProgress.next_review_due <= now
        )
    )
    total_due_count = due_query.count()

    due_items = []
    for word, prog in due_pairs:
        due_date = prog.next_review_due
        if due_date is not None and due_date.tzinfo is None:
            due_date = due_date.replace(tzinfo=timezone.utc)
        is_overdue = due_date is not None and due_date < now
        options = generate_mcq_options(db, word, total_options=4)
        due_items.append(
            ReviewDueItem(
                id=word.id,
                word_id=word.id,
                deck_id=word.deck_id,
                deck_name=word.deck.name if word.deck else None,
                kanji=word.kanji,
                kana=word.kana,
                romaji=word.romaji,
                meaning=word.meaning,
                jlpt_level=word.jlpt_level,
                level=word.jlpt_level,
                part_of_speech=word.part_of_speech,
                example_ja=word.example_ja,
                example_en=word.example_en,
                example_sentence=word.example_ja,
                example_translation=word.example_en,
                mnemonic=word.mnemonic,
                star_rating=prog.star_rating,
                stars=prog.star_rating,
                repetitions=prog.repetitions,
                interval_days=prog.interval_days,
                ease_factor=prog.ease_factor,
                next_review_due=prog.next_review_due,
                is_overdue=is_overdue,
                options=options
            )
        )

    return {
        "due_count": total_due_count,
        "queue_size": total_in_queue,
        "session_size": len(due_items),
        "cards": due_items
    }


@router.post("/submit", response_model=ReviewSubmitResponse)
def submit_review(
    payload: ReviewSubmitRequest,
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Submits a review rating (again, hard, good, easy) for a vocabulary card,
    calculates the next SM-2 interval and ease factor, updates the star level,
    and logs the review event.
    """
    word = db.query(Word).filter(Word.id == payload.word_id).first()
    if not word:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word not found.")

    # Determine correctness from selected_option, is_correct, or rating
    is_correct = False
    if payload.selected_option is not None:
        is_correct = (payload.selected_option.strip().lower() == word.meaning.strip().lower())
    elif payload.is_correct is not None:
        is_correct = bool(payload.is_correct)
    elif payload.rating:
        r = payload.rating.strip().lower()
        is_correct = r in ("good", "easy", "correct", "pass", "hard")
        if r == "hard":
            is_correct = True

    # Map to SM-2 rating:
    if payload.rating and payload.rating.strip().lower() in ("again", "hard", "good", "easy"):
        rating_normalized = payload.rating.strip().lower()
    else:
        if is_correct:
            if payload.response_time_ms and payload.response_time_ms < 3000:
                rating_normalized = "easy"
            else:
                rating_normalized = "good"
        else:
            rating_normalized = "again"

    prog = db.query(UserProgress).filter_by(user_id=user.id, word_id=word.id).first()
    now = datetime.now(timezone.utc)

    if not prog:
        prog = UserProgress(
            user_id=user.id,
            word_id=word.id,
            is_in_review=True,
            star_rating=1,
            repetitions=0,
            interval_days=0.0,
            ease_factor=2.5,
            streak=0,
            correct_streak=0,
            total_attempts=0,
            correct_attempts=0
        )
        db.add(prog)
        db.flush()

    stars_before = prog.star_rating
    interval_before = prog.interval_days
    ease_before = prog.ease_factor

    # Compute SM-2 update
    schedule = calculate_sm2_schedule(
        rating=rating_normalized,
        current_reps=prog.repetitions,
        current_interval=prog.interval_days,
        current_ease=prog.ease_factor,
        current_streak=prog.streak
    )

    # Apply updates to progress
    prog.repetitions = schedule["repetitions"]
    prog.interval_days = schedule["interval_days"]
    prog.ease_factor = schedule["ease_factor"]
    prog.streak = schedule["streak"]
    prog.correct_streak = schedule["streak"]
    prog.star_rating = schedule["star_rating"]
    prog.next_review_due = schedule["next_review_due"]
    prog.last_reviewed_at = now
    prog.total_attempts += 1
    if schedule["is_correct"]:
        prog.correct_attempts += 1

    # Log review attempt
    review_log = ReviewLog(
        user_id=user.id,
        word_id=word.id,
        rating=rating_normalized,
        grade=schedule["grade"],
        interval_before=interval_before,
        interval_after=prog.interval_days,
        ease_before=ease_before,
        ease_after=prog.ease_factor,
        stars_before=stars_before,
        stars_after=prog.star_rating,
        response_time_ms=payload.response_time_ms or 0,
        reviewed_at=now
    )
    db.add(review_log)
    db.commit()

    rating_messages = {
        "again": "Reset to 1 day. Review again soon!",
        "hard": f"Advancing with care. Next due in {prog.interval_days} days.",
        "good": f"Great recall! Next review in {prog.interval_days} days.",
        "easy": f"Effortless mastery! Next review in {prog.interval_days} days."
    }

    return ReviewSubmitResponse(
        word_id=word.id,
        rating=rating_normalized,
        grade=schedule["grade"],
        is_correct=schedule["is_correct"],
        correct_meaning=word.meaning,
        star_rating_before=stars_before,
        star_rating_after=prog.star_rating,
        stars=prog.star_rating,
        newStars=prog.star_rating,
        repetitions=prog.repetitions,
        interval_days=prog.interval_days,
        ease_factor=prog.ease_factor,
        streak=prog.streak,
        next_review_due=prog.next_review_due,
        message=rating_messages.get(rating_normalized, "Review recorded.")
    )
