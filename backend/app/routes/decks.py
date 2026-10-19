from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Word, UserProgress, QuizLog
from app.schemas import DeckStats

router = APIRouter(prefix="/decks", tags=["Decks"])

@router.get("/summary", response_model=DeckStats)
def get_deck_summary(
    level: Optional[str] = Query(None, description="Optional filter by 'N5' or 'N4'"),
    db: Session = Depends(get_db)
):
    """
    Computes overall statistics: total count, star rating breakdown,
    accuracy percentage, and counts by JLPT level.
    """
    query = db.query(Word, UserProgress).join(UserProgress, Word.id == UserProgress.word_id)
    if level:
        query = query.filter(Word.jlpt_level == level)

    all_pairs = query.all()
    total_words = len(all_pairs)

    star_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    mastered = 0
    familiar = 0
    learning = 0
    unfamiliar = 0
    total_attempts = 0
    correct_attempts = 0

    for word, prog in all_pairs:
        s = prog.star_rating
        star_distribution[s] = star_distribution.get(s, 0) + 1
        if s == 5:
            mastered += 1
        elif s in (3, 4):
            familiar += 1
        elif s == 2:
            learning += 1
        else:
            unfamiliar += 1

        total_attempts += prog.total_attempts
        correct_attempts += prog.correct_attempts

    overall_accuracy = 0.0
    if total_attempts > 0:
        overall_accuracy = round((correct_attempts / total_attempts) * 100, 1)

    # Count by level
    level_counts = {}
    level_query = db.query(Word.jlpt_level, func.count(Word.id)).group_by(Word.jlpt_level).all()
    for lvl, count in level_query:
        level_counts[lvl] = count

    return DeckStats(
        total_words=total_words,
        mastered_count=mastered,
        familiar_count=familiar,
        learning_count=learning,
        unfamiliar_count=unfamiliar,
        overall_accuracy=overall_accuracy,
        total_reviews_done=total_attempts,
        star_distribution=star_distribution,
        level_counts=level_counts
    )

@router.post("/reset")
def reset_progress(
    level: Optional[str] = Query(None, description="Reset only 'N5' or 'N4', or all if omitted"),
    db: Session = Depends(get_db)
):
    """Resets all star ratings and streaks back to initial 1-star state."""
    query = db.query(UserProgress)
    if level:
        word_ids = db.query(Word.id).filter(Word.jlpt_level == level).subquery()
        query = query.filter(UserProgress.word_id.in_(word_ids))

    query.update({
        UserProgress.star_rating: 1,
        UserProgress.correct_streak: 0,
        UserProgress.total_attempts: 0,
        UserProgress.correct_attempts: 0,
        UserProgress.last_reviewed_at: None
    }, synchronize_session=False)

    db.commit()
    return {"status": "success", "message": f"Progress successfully reset for {level or 'all'} words."}
