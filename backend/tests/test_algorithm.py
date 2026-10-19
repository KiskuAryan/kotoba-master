import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import Word, UserProgress
from app.algorithm import (
    update_mastery_rating,
    select_weighted_word,
    generate_mcq_options,
    STAR_WEIGHTS
)

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()

def test_update_mastery_promotion():
    # 1 Star -> 2 Stars with 1 correct
    stars, streak, change = update_mastery_rating(current_stars=1, current_streak=0, is_correct=True)
    assert stars == 2
    assert streak == 1
    assert change == 1

    # 2 Stars with streak 1 -> needs streak 2
    stars, streak, change = update_mastery_rating(current_stars=2, current_streak=1, is_correct=True)
    assert stars == 3
    assert streak == 2
    assert change == 1

    # 5 Stars remains 5 stars
    stars, streak, change = update_mastery_rating(current_stars=5, current_streak=10, is_correct=True)
    assert stars == 5
    assert streak == 11
    assert change == 0

def test_update_mastery_demotion():
    # Mistake on 5-Star drops to 3-Star (-2 penalty)
    stars, streak, change = update_mastery_rating(current_stars=5, current_streak=8, is_correct=False)
    assert stars == 3
    assert streak == 0
    assert change == -2

    # Mistake on 4-Star drops to 2-Star
    stars, streak, change = update_mastery_rating(current_stars=4, current_streak=5, is_correct=False)
    assert stars == 2
    assert streak == 0
    assert change == -2

    # Mistake on 2-Star drops to 1-Star
    stars, streak, change = update_mastery_rating(current_stars=2, current_streak=1, is_correct=False)
    assert stars == 1
    assert streak == 0
    assert change == -1

    # Mistake on 1-Star stays at 1-Star
    stars, streak, change = update_mastery_rating(current_stars=1, current_streak=0, is_correct=False)
    assert stars == 1
    assert streak == 0
    assert change == 0

def test_weighted_sampling_distribution(db_session):
    """Ensure 1-star words have significantly higher pick rate than 5-star words."""
    # Create word A (1 Star, weight=10.0)
    word_a = Word(kana="ことばA", romaji="kotobaA", meaning="meaning A", jlpt_level="N5", part_of_speech="noun")
    db_session.add(word_a)
    db_session.flush()
    db_session.add(UserProgress(word_id=word_a.id, star_rating=1, is_in_review=True))

    # Create word B (5 Stars, weight=0.2)
    word_b = Word(kana="ことばB", romaji="kotobaB", meaning="meaning B", jlpt_level="N5", part_of_speech="noun")
    db_session.add(word_b)
    db_session.flush()
    db_session.add(UserProgress(word_id=word_b.id, star_rating=5, is_in_review=True))
    db_session.commit()

    samples_a = 0
    samples_b = 0
    iterations = 500

    for _ in range(iterations):
        picked = select_weighted_word(db_session)
        if picked.id == word_a.id:
            samples_a += 1
        else:
            samples_b += 1

    # With weight ratio 10.0 : 0.2 (50:1), word_a should get > 90% of samples
    assert samples_a > (iterations * 0.85)
    assert samples_b < (iterations * 0.15)

def test_generate_mcq_options(db_session):
    # Seed 5 words
    for i in range(5):
        w = Word(kana=f"kana{i}", romaji=f"romaji{i}", meaning=f"meaning {i}", jlpt_level="N5", part_of_speech="verb")
        db_session.add(w)
    db_session.commit()

    target = db_session.query(Word).first()
    options = generate_mcq_options(db_session, target, total_options=4)

    assert len(options) == 4
    assert len(set(options)) == 4  # All unique
    assert target.meaning in options

def test_build_review_session_interleaving(db_session):
    from app.algorithm import build_review_session

    # Seed 10 words in Lesson 1 (mastered / high star)
    for i in range(1, 11):
        w = Word(
            lesson_number=1,
            kana=f"l1_word_{i}",
            romaji=f"l1_romaji_{i}",
            meaning=f"l1_meaning_{i}",
            jlpt_level="N5",
            part_of_speech="noun"
        )
        db_session.add(w)
        db_session.flush()
        db_session.add(UserProgress(
            word_id=w.id,
            star_rating=4,
            is_in_review=True
        ))

    # Seed 10 words in Lesson 4 (currently active, 1-2 stars)
    for i in range(1, 11):
        w = Word(
            lesson_number=4,
            kana=f"l4_word_{i}",
            romaji=f"l4_romaji_{i}",
            meaning=f"l4_meaning_{i}",
            jlpt_level="N5",
            part_of_speech="noun"
        )
        db_session.add(w)
        db_session.flush()
        db_session.add(UserProgress(
            word_id=w.id,
            star_rating=1,
            is_in_review=True
        ))

    db_session.commit()

    # Build a 10-word review session targeting Lesson 4 with interleaving
    words, is_early, due_count = build_review_session(
        db_session,
        session_size=10,
        lesson_number=4,
        include_retention_interleaving=True
    )

    assert len(words) == 10
    # Every word must be unique
    word_ids = [w.id for w in words]
    assert len(word_ids) == len(set(word_ids))

    # Check presence of primary lesson 4 words AND retention lesson 1 words
    l4_words = [w for w in words if w.lesson_number == 4]
    l1_retention_words = [w for w in words if w.lesson_number == 1]

    # Lesson 4 should be the primary focus (~7-8 words)
    assert len(l4_words) >= 6
    # Lesson 1 should have interleaved retention checks (~2-3 words)
    assert len(l1_retention_words) >= 1
    for rw in l1_retention_words:
        assert getattr(rw, "is_retention_check", False) is True

    # If interleaving is disabled, 100% of words should come from Lesson 4
    words_no_interleave, _, _ = build_review_session(
        db_session,
        session_size=10,
        lesson_number=4,
        include_retention_interleaving=False
    )
    assert all(w.lesson_number == 4 for w in words_no_interleave)
