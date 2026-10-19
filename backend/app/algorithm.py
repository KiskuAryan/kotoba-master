import random
from typing import List, Tuple, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.models import Word, UserProgress

# ==================== SM-2 SPACED REPETITION ENGINE ====================

RATING_GRADES = {
    "again": 1,
    "hard": 2,
    "good": 3,
    "easy": 4,
    1: 1,
    2: 2,
    3: 3,
    4: 4
}

def derive_star_rating(interval_days: float, repetitions: int) -> int:
    """
    Derives the visible 1-5 star mastery level from the SM-2 interval and repetition count.
    - 1★ (Unfamiliar): Not yet learned or failed (reps == 0 or interval < 1 day)
    - 2★ (Learning): Short-term memory (interval 1 to 4 days)
    - 3★ (Familiar): Medium-term retention (interval 5 to 14 days)
    - 4★ (Proficient): Strong retention (interval 15 to 30 days)
    - 5★ (Mastered): Long-term mastery (interval > 30 days)
    """
    if repetitions == 0 or interval_days < 1.0:
        return 1
    elif interval_days < 5.0:
        return 2
    elif interval_days < 15.0:
        return 3
    elif interval_days <= 30.0:
        return 4
    else:
        return 5


def calculate_sm2_schedule(
    rating: str | int,
    current_reps: int = 0,
    current_interval: float = 0.0,
    current_ease: float = 2.5,
    current_streak: int = 0
) -> Dict[str, Any]:
    """
    Calculates the next SM-2 interval, ease factor, repetition count, and derived star level.
    Ratings:
      - 'again' (1): Fail. Reset repetitions to 0, interval to 1 day, reduce ease factor.
      - 'hard'  (2): Pass with difficulty. Advance reps, conservative interval multiplier (1.2x), ease -= 0.15.
      - 'good'  (3): Standard success. Standard SM-2 interval growth, ease maintained.
      - 'easy'  (4): Effortless recall. Aggressive interval bonus (1.3x), ease += 0.15.
    """
    grade = RATING_GRADES.get(rating, 3)

    ease = max(1.3, float(current_ease))
    reps = int(current_reps)
    interval = float(current_interval)
    streak = int(current_streak)
    is_correct = grade > 1

    if grade == 1:  # Again / Fail
        reps = 0
        interval = 1.0
        ease = max(1.3, round(ease - 0.20, 2))
        streak = 0
    elif grade == 2:  # Hard / Difficult pass
        if reps == 0:
            interval = 1.0
        else:
            interval = max(1.0, round(interval * 1.2, 1))
        reps += 1
        ease = max(1.3, round(ease - 0.15, 2))
        streak += 1
    elif grade == 3:  # Good / Standard pass
        if reps == 0:
            interval = 1.0
        elif reps == 1:
            interval = 6.0
        else:
            interval = max(1.0, round(interval * ease, 1))
        reps += 1
        streak += 1
    elif grade == 4:  # Easy / Perfect pass
        if reps == 0:
            interval = 2.0
        elif reps == 1:
            interval = 7.0
        else:
            interval = max(1.0, round(interval * ease * 1.3, 1))
        reps += 1
        ease = min(3.5, round(ease + 0.15, 2))
        streak += 1

    star_rating = derive_star_rating(interval, reps)
    now = datetime.now(timezone.utc)
    next_due = now + timedelta(days=interval)

    return {
        "grade": grade,
        "is_correct": is_correct,
        "repetitions": reps,
        "interval_days": interval,
        "ease_factor": ease,
        "streak": streak,
        "star_rating": star_rating,
        "next_review_due": next_due
    }


def get_due_words_for_user(
    db: Session,
    user_id: int,
    deck_id: Optional[int] = None,
    limit: int = 20
) -> List[Tuple[Word, UserProgress]]:
    """
    Returns vocabulary items due for review according to SM-2 due dates.
    Prioritizes overdue cards, then items without scheduled due dates.
    """
    now = datetime.now(timezone.utc)
    query = db.query(Word, UserProgress).join(
        UserProgress,
        (Word.id == UserProgress.word_id) & (UserProgress.user_id == user_id)
    ).filter(
        UserProgress.is_in_review == True,
        or_(
            UserProgress.next_review_due == None,
            UserProgress.next_review_due <= now
        )
    )

    if deck_id is not None:
        query = query.filter(Word.deck_id == deck_id)

    # Order by: never reviewed first (None), then oldest due date (most overdue)
    query = query.order_by(
        UserProgress.next_review_due.asc().nullsfirst()
    ).limit(limit)

    return query.all()


# ==================== BACKWARD COMPATIBILITY HELPERS ====================
STAR_WEIGHTS = {1: 10.0, 2: 6.0, 3: 3.0, 4: 1.0, 5: 0.2}
STREAK_REQUIREMENTS = {1: 1, 2: 2, 3: 4, 4: 6, 5: 8}
STAR_INTERVALS_MINUTES = {1: 10, 2: 120, 3: 1440, 4: 4320, 5: 10080}

def get_next_review_due_time(star_rating: int, is_correct: bool) -> datetime:
    now = datetime.now(timezone.utc)
    if is_correct:
        mins = STAR_INTERVALS_MINUTES.get(star_rating, 60)
        return now + timedelta(minutes=mins)
    return now + timedelta(minutes=5)

def update_mastery_rating(current_stars: int, current_streak: int, is_correct: bool) -> Tuple[int, int, int]:
    if is_correct:
        new_streak = current_streak + 1
        new_stars = current_stars
        if current_stars < 5:
            required = STREAK_REQUIREMENTS.get(current_stars, 2)
            if new_streak >= required:
                new_stars = current_stars + 1
        return new_stars, new_streak, (new_stars - current_stars)
    else:
        new_streak = 0
        if current_stars >= 4:
            new_stars = current_stars - 2
        else:
            new_stars = max(1, current_stars - 1)
        return new_stars, 0, (new_stars - current_stars)

def build_review_session(
    db: Session,
    session_size: int = 10,
    lesson_number: Optional[int] = None,
    include_retention_interleaving: bool = True,
    user_id: Optional[int] = None
) -> Tuple[List[Word], bool, int]:
    now = datetime.now(timezone.utc)
    selected_ids = set()
    primary_words: List[Word] = []
    retention_words: List[Word] = []

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

    retention_target = 0
    if include_retention_interleaving:
        if lesson_number and lesson_number > 1:
            retention_target = max(1, round(session_size * 0.25))
        elif lesson_number is None:
            retention_target = max(1, round(session_size * 0.25))

    if retention_target > 0:
        if lesson_number and lesson_number > 1:
            prev_scope = db.query(Word).join(UserProgress, Word.id == UserProgress.word_id).filter(
                UserProgress.is_in_review == True,
                Word.lesson_number < lesson_number
            )
        else:
            prev_scope = db.query(Word).join(UserProgress, Word.id == UserProgress.word_id).filter(
                UserProgress.is_in_review == True,
                UserProgress.star_rating >= 3
            )

        if user_id:
            prev_scope = prev_scope.filter(UserProgress.user_id == user_id)

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
