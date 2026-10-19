from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Word, UserProgress, QuizLog
from app.schemas import QuizQuestionOut, QuizAnswerSubmit, QuizAnswerResult
from app.algorithm import select_weighted_word, generate_mcq_options, update_mastery_rating

router = APIRouter(prefix="/quiz", tags=["Quiz"])

@router.get("/next", response_model=QuizQuestionOut)
def get_next_question(
    level: Optional[str] = Query(None, description="Filter by JLPT level: 'N5' or 'N4'"),
    exclude: Optional[str] = Query(None, description="Comma-separated IDs of recently answered words"),
    db: Session = Depends(get_db)
):
    """
    Returns the next recall question using inverse-weighted sampling.
    Lower-star words have significantly higher appearance frequency.
    """
    exclude_ids = []
    if exclude:
        try:
            exclude_ids = [int(i.strip()) for i in exclude.split(",") if i.strip().isdigit()]
        except ValueError:
            pass

    target_word = select_weighted_word(db, jlpt_level=level, exclude_ids=exclude_ids)
    if not target_word:
        raise HTTPException(status_code=404, detail="No vocabulary words found for the specified criteria.")

    # Get current star rating
    stars = 1
    if target_word.progress:
        stars = target_word.progress.star_rating

    options = generate_mcq_options(db, target_word)

    return QuizQuestionOut(
        word_id=target_word.id,
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
    Evaluates submitted answer, updates 5-star mastery rating and streaks,
    and returns immediate feedback.
    """
    word = db.query(Word).filter(Word.id == submission.word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found.")

    progress = db.query(UserProgress).filter(UserProgress.word_id == word.id).first()
    if not progress:
        progress = UserProgress(word_id=word.id, star_rating=1)
        db.add(progress)
        db.flush()

    is_correct = (submission.selected_option.strip().lower() == word.meaning.strip().lower())

    stars_before = progress.star_rating
    new_stars, new_streak, star_change = update_mastery_rating(
        current_stars=stars_before,
        current_streak=progress.correct_streak,
        is_correct=is_correct
    )

    # Update progress record
    progress.star_rating = new_stars
    progress.correct_streak = new_streak
    progress.total_attempts += 1
    if is_correct:
        progress.correct_attempts += 1
    progress.last_reviewed_at = datetime.now(timezone.utc)

    # Log quiz event
    quiz_log = QuizLog(
        word_id=word.id,
        selected_meaning=submission.selected_option,
        is_correct=is_correct,
        star_rating_before=stars_before,
        star_rating_after=new_stars
    )
    db.add(quiz_log)
    db.commit()

    return QuizAnswerResult(
        word_id=word.id,
        is_correct=is_correct,
        correct_meaning=word.meaning,
        star_rating_before=stars_before,
        star_rating_after=new_stars,
        correct_streak=new_streak,
        star_change=star_change,
        example_ja=word.example_ja,
        example_en=word.example_en
    )
