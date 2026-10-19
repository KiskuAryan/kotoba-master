import random
from typing import List, Tuple, Optional
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.models import Word, UserProgress

# Inverse weighting table
STAR_WEIGHTS = {
    1: 10.0,
    2: 6.0,
    3: 3.0,
    4: 1.0,
    5: 0.2
}

# Consecutive correct recalls needed to graduate to next star
STREAK_REQUIREMENTS = {
    1: 1,
    2: 2,
    3: 4,
    4: 6,
    5: 8
}

# Spaced Review Intervals (in minutes) based on AHA Lab SRS model
STAR_INTERVALS_MINUTES = {
    1: 10,       # 1 Star: 10 mins (unfamiliar / struggling)
    2: 120,      # 2 Stars: 2 hours
    3: 1440,     # 3 Stars: 24 hours (1 day)
    4: 4320,     # 4 Stars: 3 days
    5: 10080     # 5 Stars: 7 days
}

def get_next_review_due_time(star_rating: int, is_correct: bool) -> datetime:
    """Computes the timestamp when the word should next appear for review."""
    now = datetime.now(timezone.utc)
    if is_correct:
        mins = STAR_INTERVALS_MINUTES.get(star_rating, 60)
        return now + timedelta(minutes=mins)
    else:
        # Mistakes reappear in 5 minutes for quick reinforcement
        return now + timedelta(minutes=5)

def update_mastery_rating(
    current_stars: int,
    current_streak: int,
    is_correct: bool
) -> Tuple[int, int, int]:
    """Computes new star rating and streak."""
    if is_correct:
        new_streak = current_streak + 1
        new_stars = current_stars
        
        if current_stars < 5:
            required = STREAK_REQUIREMENTS.get(current_stars, 2)
            if new_streak >= required:
                new_stars = current_stars + 1

        star_change = new_stars - current_stars
        return new_stars, new_streak, star_change
    else:
        new_streak = 0
        if current_stars >= 4:
            new_stars = current_stars - 2
        elif current_stars > 1:
            new_stars = current_stars - 1
        else:
            new_stars = 1

        star_change = new_stars - current_stars
        return new_stars, new_streak, star_change


def build_review_session(
    db: Session,
    session_size: int = 10,
    lesson_number: Optional[int] = None
) -> Tuple[List[Word], bool, int]:
    """
    Constructs a finite review batch (AHA Lab style):
    1. If words are due (next_review_due <= now or None):
       - Prioritizes lowest proficiency first (star_rating ASC), then oldest reviewed first.
       - Each word appears exactly ONCE in this session.
    2. If NO words are currently due (or all are equally mastered):
       - Runs Early Practice by pulling lowest proficiency words first, then oldest review.
    Returns: (session_words, is_early_practice, total_due_count)
    """
    now = datetime.now(timezone.utc)

    base_query = db.query(Word).join(UserProgress, Word.id == UserProgress.word_id).filter(
        UserProgress.is_in_review == True
    )

    if lesson_number:
        base_query = base_query.filter(Word.lesson_number == lesson_number)

    # 1. Count & collect DUE words
    due_query = base_query.filter(
        or_(
            UserProgress.next_review_due.is_(None),
            UserProgress.next_review_due <= now
        )
    )
    due_count = due_query.count()

    if due_count > 0:
        # Prioritize: 1) Lowest proficiency (star_rating ASC), 2) Oldest reviewed (nulls first)
        words = due_query.order_by(
            UserProgress.star_rating.asc(),
            UserProgress.last_reviewed_at.asc().nullsfirst()
        ).limit(session_size).all()
        return words, False, due_count
    else:
        # Early Practice mode: Pull lowest proficiency words first so practice is never empty
        words = base_query.order_by(
            UserProgress.star_rating.asc(),
            UserProgress.last_reviewed_at.asc().nullsfirst()
        ).limit(session_size).all()
        return words, True, 0


def select_weighted_word(
    db: Session,
    jlpt_level: Optional[str] = None,
    lesson_number: Optional[int] = None,
    only_in_review: bool = True,
    exclude_ids: Optional[List[int]] = None
) -> Optional[Word]:
    """Fallback single-word weighted selector."""
    query = db.query(Word, UserProgress.star_rating).join(
        UserProgress, Word.id == UserProgress.word_id
    )

    if only_in_review:
        query = query.filter(UserProgress.is_in_review == True)

    if lesson_number:
        query = query.filter(Word.lesson_number == lesson_number)

    if jlpt_level:
        query = query.filter(Word.jlpt_level == jlpt_level)

    candidates = query.all()
    if not candidates:
        return None

    if exclude_ids:
        filtered = [c for c in candidates if c[0].id not in exclude_ids]
        if len(filtered) >= 1:
            candidates = filtered

    words = [c[0] for c in candidates]
    weights = [STAR_WEIGHTS.get(c[1], 5.0) for c in candidates]
    return random.choices(words, weights=weights, k=1)[0]


def generate_mcq_options(
    db: Session,
    target_word: Word,
    total_options: int = 4
) -> List[str]:
    """Selects 3 plausible distractors and combines with target meaning, shuffled."""
    same_category = db.query(Word.meaning).filter(
        Word.id != target_word.id,
        Word.part_of_speech == target_word.part_of_speech,
        Word.jlpt_level == target_word.jlpt_level
    ).order_by(func.random()).limit(total_options - 1).all()

    distractor_meanings = [row[0] for row in same_category]

    if len(distractor_meanings) < total_options - 1:
        needed = (total_options - 1) - len(distractor_meanings)
        additional = db.query(Word.meaning).filter(
            Word.id != target_word.id,
            Word.jlpt_level == target_word.jlpt_level,
            ~Word.meaning.in_(distractor_meanings + [target_word.meaning])
        ).order_by(func.random()).limit(needed).all()
        distractor_meanings.extend([row[0] for row in additional])

    if len(distractor_meanings) < total_options - 1:
        needed = (total_options - 1) - len(distractor_meanings)
        fallback = db.query(Word.meaning).filter(
            Word.id != target_word.id,
            ~Word.meaning.in_(distractor_meanings + [target_word.meaning])
        ).order_by(func.random()).limit(needed).all()
        distractor_meanings.extend([row[0] for row in fallback])

    all_options = distractor_meanings + [target_word.meaning]
    random.shuffle(all_options)
    return all_options
