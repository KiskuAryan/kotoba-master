import random
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Word, UserProgress

# Inverse weighting table: Lower stars appear far more frequently
STAR_WEIGHTS = {
    1: 10.0,  # 1 Star: Unfamiliar / Struggling (High probability)
    2: 6.0,   # 2 Stars: Learning
    3: 3.0,   # 3 Stars: Familiar
    4: 1.0,   # 4 Stars: Strong
    5: 0.2    # 5 Stars: Mastered (Rare review)
}

# Consecutive correct recalls needed to graduate to next star
STREAK_REQUIREMENTS = {
    1: 1,  # 1 -> 2: Needs 1 correct
    2: 2,  # 2 -> 3: Needs 2 consecutive
    3: 4,  # 3 -> 4: Needs 4 consecutive
    4: 6,  # 4 -> 5: Needs 6 consecutive
    5: 8   # Mastered retention
}

def update_mastery_rating(
    current_stars: int,
    current_streak: int,
    is_correct: bool
) -> Tuple[int, int, int]:
    """
    Computes new star rating and streak following the 5-star SRS model.
    Returns: (new_stars, new_streak, star_change)
    """
    if is_correct:
        new_streak = current_streak + 1
        new_stars = current_stars
        
        # Check if streak satisfies graduation threshold
        if current_stars < 5:
            required = STREAK_REQUIREMENTS.get(current_stars, 2)
            if new_streak >= required:
                new_stars = current_stars + 1

        star_change = new_stars - current_stars
        return new_stars, new_streak, star_change
    else:
        # Reset streak on error
        new_streak = 0
        
        # Demote stars on error (higher stars lose 2 levels, lower stars lose 1)
        if current_stars >= 4:
            new_stars = current_stars - 2
        elif current_stars > 1:
            new_stars = current_stars - 1
        else:
            new_stars = 1

        star_change = new_stars - current_stars
        return new_stars, new_streak, star_change


def select_weighted_word(
    db: Session,
    jlpt_level: Optional[str] = None,
    exclude_ids: Optional[List[int]] = None
) -> Optional[Word]:
    """
    Selects a Word using inverse-weighted random distribution based on its star rating.
    Allows filtering by JLPT level and excluding recently presented word IDs.
    """
    query = db.query(Word, UserProgress.star_rating).join(
        UserProgress, Word.id == UserProgress.word_id
    )

    if jlpt_level:
        query = query.filter(Word.jlpt_level == jlpt_level)

    candidates = query.all()
    if not candidates:
        return None

    # Filter out excluded IDs if sufficient alternatives exist
    if exclude_ids:
        filtered = [c for c in candidates if c[0].id not in exclude_ids]
        if len(filtered) >= 3:
            candidates = filtered

    # Compute weights based on star ratings
    words = [c[0] for c in candidates]
    weights = [STAR_WEIGHTS.get(c[1], 5.0) for c in candidates]

    # Weighted random sampling
    chosen = random.choices(words, weights=weights, k=1)[0]
    return chosen


def generate_mcq_options(
    db: Session,
    target_word: Word,
    total_options: int = 4
) -> List[str]:
    """
    Selects 3 plausible distractors and combines with target meaning, shuffled.
    Prefers distractors from the same part of speech and JLPT level.
    """
    # 1. Try to find distractors with the same part of speech and level
    same_category = db.query(Word.meaning).filter(
        Word.id != target_word.id,
        Word.part_of_speech == target_word.part_of_speech,
        Word.jlpt_level == target_word.jlpt_level
    ).order_by(func.random()).limit(total_options - 1).all()

    distractor_meanings = [row[0] for row in same_category]

    # 2. If not enough, pull from the same JLPT level
    if len(distractor_meanings) < total_options - 1:
        needed = (total_options - 1) - len(distractor_meanings)
        additional = db.query(Word.meaning).filter(
            Word.id != target_word.id,
            Word.jlpt_level == target_word.jlpt_level,
            ~Word.meaning.in_(distractor_meanings + [target_word.meaning])
        ).order_by(func.random()).limit(needed).all()
        distractor_meanings.extend([row[0] for row in additional])

    # 3. If still not enough, pull from any word
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
