from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Word, UserProgress, QuizLog, ChapterProgress
from app.schemas import QuizQuestionOut, QuizAnswerSubmit, QuizAnswerResult
from app.algorithm import select_weighted_word, generate_mcq_options, update_mastery_rating

router = APIRouter(prefix="/quiz", tags=["Quiz"])

@router.get("/next", response_model=QuizQuestionOut)
def get_next_question(
    level: Optional[str] = Query(None, description="Filter by JLPT level: 'N5' or 'N4'"),
    lesson: Optional[int] = Query(None, description="Filter by Minna no Nihongo Lesson (1-25)"),
    only_in_review: bool = Query(True, description="Only test words added to user's review queue"),
    exclude: Optional[str] = Query(None, description="Comma-separated IDs of recently answered words"),
    db: Session = Depends(get_db)
):
    """
    Returns the next recall question using inverse-weighted sampling.
    Pulls strictly from words in the active review queue unless only_in_review=False.
    """
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
        # Check if the review queue is empty
        total_in_review = db.query(UserProgress).filter(UserProgress.is_in_review == True).count()
        if total_in_review == 0 and only_in_review:
            raise HTTPException(
                status_code=404,
                detail="EMPTY_REVIEW_QUEUE: Your review queue is empty. Go to the Learn section to study flashcards and click 'Add to Review'!"
            )
        raise HTTPException(status_code=404, detail="No matching vocabulary words found.")

    stars = 1
    if target_word.progress:
        stars = target_word.progress.star_rating

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
    Evaluates submitted answer, updates 5-star mastery rating and streaks,
    and checks if the chapter mastery unlocks the next lesson.
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
    db.flush()

    # Check Chapter Unlock Status (if current chapter reaches 75% mastery)
    chapter_unlocked = None
    lesson_num = word.lesson_number
    next_chap = db.query(ChapterProgress).filter_by(lesson_number=lesson_num + 1).first()

    if next_chap and not next_chap.is_unlocked:
        # Calculate current chapter mastery
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
                next_chap.unlocked_at = datetime.now(timezone.utc)
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
