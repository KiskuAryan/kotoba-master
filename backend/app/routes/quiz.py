from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.database import get_db
from app.models import Word, UserProgress, QuizLog, ChapterProgress
from app.schemas import (
    QuizQuestionOut,
    QuizAnswerSubmit,
    QuizAnswerResult,
    QuizSessionOut,
    QuizStatusOut
)
from app.algorithm import (
    select_weighted_word,
    generate_mcq_options,
    update_mastery_rating,
    build_review_session,
    get_next_review_due_time
)

router = APIRouter(prefix="/quiz", tags=["Quiz"])

@router.get("/status", response_model=QuizStatusOut)
def get_quiz_status(
    lesson: Optional[int] = Query(None, description="Optional lesson filter"),
    db: Session = Depends(get_db)
):
    """
    Returns review queue status: how many words are due, how many in queue,
    and minutes until the next scheduled review.
    """
    now = datetime.now(timezone.utc)
    base_query = db.query(UserProgress).filter(UserProgress.is_in_review == True)
    if lesson:
        w_ids = db.query(Word.id).filter(Word.lesson_number == lesson).subquery()
        base_query = base_query.filter(UserProgress.word_id.in_(w_ids))

    total_in_review = base_query.count()

    due_count = base_query.filter(
        or_(
            UserProgress.next_review_due.is_(None),
            UserProgress.next_review_due <= now
        )
    ).count()

    # Find earliest upcoming review
    next_due_word = base_query.filter(UserProgress.next_review_due > now).order_by(
        UserProgress.next_review_due.asc()
    ).first()

    next_due_mins = None
    if next_due_word and next_due_word.next_review_due:
        diff = (next_due_word.next_review_due - now).total_seconds()
        next_due_mins = max(1, int(diff // 60))

    return QuizStatusOut(
        due_count=due_count,
        total_in_review=total_in_review,
        next_due_in_minutes=next_due_mins,
        can_early_practice=(total_in_review > 0)
    )


@router.get("/session", response_model=QuizSessionOut)
def start_quiz_session(
    size: int = Query(10, ge=3, le=50, description="Session size (e.g. 5, 10, 20 words)"),
    lesson: Optional[int] = Query(None, description="Filter by Minna no Nihongo Lesson"),
    db: Session = Depends(get_db)
):
    """
    Generates a finite, structured review session batch (AHA Lab style).
    Each word appears strictly ONCE per session.
    Pulls due words first, with lowest proficiency words appearing first.
    If no words are currently due, initiates Early Practice with lowest proficiency words first.
    """
    words, is_early, due_count = build_review_session(db, session_size=size, lesson_number=lesson)

    if not words:
        raise HTTPException(
            status_code=404,
            detail="EMPTY_REVIEW_QUEUE: Your review queue is empty. Study flashcards in Learn mode and add words to review!"
        )

    questions = []
    for word in words:
        stars = word.progress.star_rating if word.progress else 1
        options = generate_mcq_options(db, word)
        questions.append(QuizQuestionOut(
            word_id=word.id,
            lesson_number=word.lesson_number,
            prompt_kanji=word.kanji,
            prompt_kana=word.kana,
            romaji=word.romaji,
            jlpt_level=word.jlpt_level,
            part_of_speech=word.part_of_speech,
            current_stars=stars,
            options=options
        ))

    return QuizSessionOut(
        total_questions=len(questions),
        is_early_practice=is_early,
        due_count=due_count,
        questions=questions
    )


@router.get("/next", response_model=QuizQuestionOut)
def get_next_question(
    level: Optional[str] = Query(None),
    lesson: Optional[int] = Query(None),
    only_in_review: bool = Query(True),
    exclude: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Fallback single-question endpoint for quick ad-hoc review."""
    exclude_ids = []
    if exclude:
        try:
            exclude_ids = [int(i.strip()) for i in exclude.split(",") if i.strip().isdigit()]
        except ValueError:
            pass

    target_word = select_weighted_word(
        db,
        jlpt_level=level,
        lesson_number=lesson,
        only_in_review=only_in_review,
        exclude_ids=exclude_ids
    )

    if not target_word:
        total_in_review = db.query(UserProgress).filter(UserProgress.is_in_review == True).count()
        if total_in_review == 0 and only_in_review:
            raise HTTPException(
                status_code=404,
                detail="EMPTY_REVIEW_QUEUE: Your review queue is empty. Go to Learn section to add words!"
            )
        raise HTTPException(status_code=404, detail="No matching vocabulary words found.")

    stars = target_word.progress.star_rating if target_word.progress else 1
    options = generate_mcq_options(db, target_word)

    return QuizQuestionOut(
        word_id=target_word.id,
        lesson_number=target_word.lesson_number,
        prompt_kanji=target_word.kanji,
        prompt_kana=target_word.kana,
        romaji=target_word.romaji,
        jlpt_level=target_word.jlpt_level,
        part_of_speech=target_word.part_of_speech,
        current_stars=stars,
        options=options
    )


@router.post("/submit", response_model=QuizAnswerResult)
def submit_quiz_answer(
    submission: QuizAnswerSubmit,
    db: Session = Depends(get_db)
):
    """
    Evaluates answer, updates 5-star rating, schedules the next review due date
    based on the word's star proficiency, and checks chapter unlocks.
    """
    word = db.query(Word).filter(Word.id == submission.word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found.")

    progress = db.query(UserProgress).filter(UserProgress.word_id == word.id).first()
    if not progress:
        progress = UserProgress(word_id=word.id, star_rating=1, is_in_review=True)
        db.add(progress)
        db.flush()

    is_correct = (submission.selected_option.strip().lower() == word.meaning.strip().lower())

    stars_before = progress.star_rating
    new_stars, new_streak, star_change = update_mastery_rating(
        current_stars=stars_before,
        current_streak=progress.correct_streak,
        is_correct=is_correct
    )

    # Schedule next review timestamp using Spaced Repetition interval
    now = datetime.now(timezone.utc)
    next_due = get_next_review_due_time(new_stars, is_correct)

    progress.star_rating = new_stars
    progress.correct_streak = new_streak
    progress.total_attempts += 1
    if is_correct:
        progress.correct_attempts += 1
    progress.last_reviewed_at = now
    progress.next_review_due = next_due

    # Log quiz history
    quiz_log = QuizLog(
        word_id=word.id,
        selected_meaning=submission.selected_option,
        is_correct=is_correct,
        star_rating_before=stars_before,
        star_rating_after=new_stars
    )
    db.add(quiz_log)
    db.flush()

    # Check Chapter Unlock
    chapter_unlocked = None
    lesson_num = word.lesson_number
    next_chap = db.query(ChapterProgress).filter_by(lesson_number=lesson_num + 1).first()

    if next_chap and not next_chap.is_unlocked:
        lesson_words = db.query(Word.id).filter(Word.lesson_number == lesson_num).all()
        if lesson_words:
            w_ids = [w[0] for w in lesson_words]
            total_stars = db.query(func.sum(UserProgress.star_rating)).filter(
                UserProgress.word_id.in_(w_ids)
            ).scalar() or 0
            max_stars = len(w_ids) * 5
            pct = (total_stars / max_stars) * 100
            if pct >= 75.0:
                next_chap.is_unlocked = True
                next_chap.unlocked_at = now
                chapter_unlocked = next_chap.lesson_number

    db.commit()

    return QuizAnswerResult(
        word_id=word.id,
        is_correct=is_correct,
        correct_meaning=word.meaning,
        star_rating_before=stars_before,
        star_rating_after=new_stars,
        correct_streak=new_streak,
        star_change=star_change,
        chapter_unlocked=chapter_unlocked,
        example_ja=word.example_ja,
        example_en=word.example_en
    )
