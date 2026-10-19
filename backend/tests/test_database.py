import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import Word, UserProgress, QuizLog
from app.seed import seed_vocab
from app.config import settings

@pytest.fixture
def db_session():
    """Create a temporary in-memory SQLite database session for unit tests."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()

def test_create_word_and_progress(db_session):
    """Verify Word and UserProgress creation and relationship."""
    word = Word(
        kanji="食べる",
        kana="たべる",
        romaji="taberu",
        meaning="to eat",
        jlpt_level="N5",
        part_of_speech="verb",
        example_ja="ご飯を食べる。",
        example_en="To eat rice."
    )
    db_session.add(word)
    db_session.commit()
    db_session.refresh(word)

    assert word.id is not None
    assert word.meaning == "to eat"

    progress = UserProgress(word_id=word.id, star_rating=1)
    db_session.add(progress)
    db_session.commit()
    db_session.refresh(word)

    assert word.progress is not None
    assert word.progress.star_rating == 1
    assert word.progress.correct_streak == 0
    assert word.progress.accuracy_rate == 0.0

def test_seed_vocab_populates_words_and_progress(db_session):
    """Verify that seed_vocab loads words and creates progress records."""
    count = seed_vocab(db_session, seed_file=settings.SEED_FILE)
    assert count == 50

    words = db_session.query(Word).all()
    assert len(words) == 50

    # Ensure all have progress initialized
    progress_count = db_session.query(UserProgress).count()
    assert progress_count == 50

    # Ensure idempotency: re-running seed does not duplicate words
    second_run = seed_vocab(db_session, seed_file=settings.SEED_FILE)
    assert second_run == 0
    assert db_session.query(Word).count() == 50

def test_quiz_log_relationship(db_session):
    """Verify QuizLog tracks history correctly."""
    word = Word(
        kanji="本",
        kana="ほん",
        romaji="hon",
        meaning="book",
        jlpt_level="N5",
        part_of_speech="noun"
    )
    db_session.add(word)
    db_session.commit()

    log = QuizLog(
        word_id=word.id,
        selected_meaning="book",
        is_correct=True,
        star_rating_before=1,
        star_rating_after=2
    )
    db_session.add(log)
    db_session.commit()

    assert len(word.quiz_logs) == 1
    assert word.quiz_logs[0].is_correct is True

def test_cascade_delete(db_session):
    """Verify deleting a Word cascades to delete UserProgress and QuizLogs."""
    word = Word(
        kanji="犬",
        kana="いぬ",
        romaji="inu",
        meaning="dog",
        jlpt_level="N5",
        part_of_speech="noun"
    )
    db_session.add(word)
    db_session.commit()

    progress = UserProgress(word_id=word.id, star_rating=3)
    log = QuizLog(
        word_id=word.id,
        selected_meaning="cat",
        is_correct=False,
        star_rating_before=3,
        star_rating_after=2
    )
    db_session.add_all([progress, log])
    db_session.commit()

    # Delete word
    db_session.delete(word)
    db_session.commit()

    assert db_session.query(UserProgress).filter_by(word_id=word.id).first() is None
    assert db_session.query(QuizLog).filter_by(word_id=word.id).first() is None
