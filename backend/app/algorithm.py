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
    lesson_number: Optional[int] = None,
    include_retention_interleaving: bool = True,
    user_id: Optional[int] = None
) -> Tuple[List[Word], bool, int]:
    """
    Constructs a finite review batch (AHA Lab style with cumulative interleaving):
    1. If lesson_number is specified (e.g. Lesson 4, Lesson 16):
       - Focus slots (~75% of batch) come from the target lesson (due words first, then early practice).
       - Retention slots (~25% of batch) are sampled from previous chapters (< lesson_number)
         favoring old mastered/near-mastered words (stars >= 3, or oldest reviewed) to ensure
         long-term retention and prevent decay.
    2. If lesson_number is None (All Active Lessons):
       - Combines due / lower-proficiency words (~75%) with periodic retention checks
         from higher-star words (~25%) so mastered words are periodically refreshed.
    3. Each word appears strictly ONCE per session (no duplicates).
    4. Words are shuffled so retention checks are naturally interleaved throughout the quiz.
    5. Scoped to user_id if provided.
    Returns: (session_words, is_early_practice, total_due_count)
    """
    now = datetime.now(timezone.utc)
    selected_ids = set()
    primary_words: List[Word] = []
    retention_words: List[Word] = []

    # Calculate overall due count for the user's current scope
    base_scope = db.query(Word).join(UserProgress, Word.id == UserProgress.word_id).filter(
        UserProgress.is_in_review == True
    )
    if user_id:
        base_scope = base_scope.filter(UserProgress.user_id == user_id)

    if lesson_number:
        scope_due_count = base_scope.filter(
            Word.lesson_number == lesson_number,
            or_(UserProgress.next_review_due.is_(None), UserProgress.next_review_due <= now)
        ).count()
    else:
        scope_due_count = base_scope.filter(
            or_(UserProgress.next_review_due.is_(None), UserProgress.next_review_due <= now)
        ).count()

    # Determine retention target count (approx 20-30% of session)
    retention_target = 0
    if include_retention_interleaving:
        if lesson_number and lesson_number > 1:
            retention_target = max(1, round(session_size * 0.25))
        elif lesson_number is None:
            retention_target = max(1, round(session_size * 0.25))

    # --- Phase 1: Sample Interleaved Retention Words (from older chapters or high mastery) ---
    if retention_target > 0:
        if lesson_number and lesson_number > 1:
            prev_scope = db.query(Word).join(UserProgress, Word.id == UserProgress.word_id).filter(
                UserProgress.is_in_review == True,
                Word.lesson_number < lesson_number
            )
        else:
            # All chapters scope: sample near-mastered words (star_rating >= 3)
            prev_scope = db.query(Word).join(UserProgress, Word.id == UserProgress.word_id).filter(
                UserProgress.is_in_review == True,
                UserProgress.star_rating >= 3
            )

        if user_id:
            prev_scope = prev_scope.filter(UserProgress.user_id == user_id)

        # 1a. Prioritize older words that are DUE first (star >= 3)
        due_retention = prev_scope.filter(
            UserProgress.star_rating >= 3,
            or_(UserProgress.next_review_due.is_(None), UserProgress.next_review_due <= now)
        ).order_by(
            UserProgress.last_reviewed_at.asc().nullsfirst(),
            func.random()
        ).limit(retention_target).all()

        for w in due_retention:
            setattr(w, "is_retention_check", True)
            retention_words.append(w)
            selected_ids.add(w.id)

        # 1b. If slots remain, sample non-due near-mastered words (oldest reviewed first)
        if len(retention_words) < retention_target:
            needed = retention_target - len(retention_words)
            query_non_due = prev_scope.filter(UserProgress.star_rating >= 3)
            if selected_ids:
                query_non_due = query_non_due.filter(~Word.id.in_(selected_ids))
            non_due_retention = query_non_due.order_by(
                UserProgress.last_reviewed_at.asc().nullsfirst(),
                func.random()
            ).limit(needed).all()

            for w in non_due_retention:
                setattr(w, "is_retention_check", True)
                retention_words.append(w)
                selected_ids.add(w.id)

        # 1c. If still needed and lesson_number > 1, allow any older chapter words (stars >= 1)
        if len(retention_words) < retention_target and lesson_number and lesson_number > 1:
            needed = retention_target - len(retention_words)
            query_any_older = prev_scope
            if selected_ids:
                query_any_older = query_any_older.filter(~Word.id.in_(selected_ids))
            any_older = query_any_older.order_by(
                UserProgress.star_rating.desc(),
                UserProgress.last_reviewed_at.asc().nullsfirst()
            ).limit(needed).all()

            for w in any_older:
                setattr(w, "is_retention_check", True)
                retention_words.append(w)
                selected_ids.add(w.id)

    # --- Phase 2: Sample Primary Focus Words ---
    primary_needed = session_size - len(retention_words)
    primary_query = db.query(Word).join(UserProgress, Word.id == UserProgress.word_id).filter(
        UserProgress.is_in_review == True
    )
    if user_id:
        primary_query = primary_query.filter(UserProgress.user_id == user_id)
    if lesson_number:
        primary_query = primary_query.filter(Word.lesson_number == lesson_number)
    if selected_ids:
        primary_query = primary_query.filter(~Word.id.in_(selected_ids))

    # 2a. Due primary words (lowest star proficiency first, oldest reviewed first)
    due_primary = primary_query.filter(
        or_(UserProgress.next_review_due.is_(None), UserProgress.next_review_due <= now)
    ).order_by(
        UserProgress.star_rating.asc(),
        UserProgress.last_reviewed_at.asc().nullsfirst()
    ).limit(primary_needed).all()

    for w in due_primary:
        setattr(w, "is_retention_check", False)
        primary_words.append(w)
        selected_ids.add(w.id)

    # 2b. If not enough due words, pull Early Practice words from target scope
    if len(primary_words) < primary_needed:
        needed = primary_needed - len(primary_words)
        early_query = primary_query
        if selected_ids:
            early_query = early_query.filter(~Word.id.in_(selected_ids))
        early_primary = early_query.order_by(
            UserProgress.star_rating.asc(),
            UserProgress.last_reviewed_at.asc().nullsfirst()
        ).limit(needed).all()

        for w in early_primary:
            setattr(w, "is_retention_check", False)
            primary_words.append(w)
            selected_ids.add(w.id)

    # 2c. If target lesson has fewer words than needed, top up from ANY active review words
    if (len(primary_words) + len(retention_words)) < session_size:
        needed = session_size - (len(primary_words) + len(retention_words))
        topup_query = db.query(Word).join(UserProgress, Word.id == UserProgress.word_id).filter(
            UserProgress.is_in_review == True
        )
        if user_id:
            topup_query = topup_query.filter(UserProgress.user_id == user_id)
        if selected_ids:
            topup_query = topup_query.filter(~Word.id.in_(selected_ids))
        topup_words = topup_query.order_by(
            UserProgress.star_rating.asc(),
            UserProgress.last_reviewed_at.asc().nullsfirst()
        ).limit(needed).all()

        for w in topup_words:
            is_ret = True if (lesson_number and w.lesson_number != lesson_number) else False
            setattr(w, "is_retention_check", is_ret)
            if is_ret:
                retention_words.append(w)
            else:
                primary_words.append(w)
            selected_ids.add(w.id)

    total_words = primary_words + retention_words
    if not total_words:
        return [], False, 0

    is_early_practice = (scope_due_count == 0)

    # Shuffle to interleave retention checks naturally throughout the session batch
    random.shuffle(total_words)

    return total_words, is_early_practice, scope_due_count


def select_weighted_word(
    db: Session,
    jlpt_level: Optional[str] = None,
    lesson_number: Optional[int] = None,
    only_in_review: bool = True,
    exclude_ids: Optional[List[int]] = None,
    user_id: Optional[int] = None
) -> Optional[Word]:
    """Fallback single-word weighted selector."""
    query = db.query(Word, UserProgress.star_rating).join(
        UserProgress, Word.id == UserProgress.word_id
    )

    if user_id:
        query = query.filter(UserProgress.user_id == user_id)

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
