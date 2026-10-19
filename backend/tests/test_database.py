import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import Word, UserProgress, QuizLog, ChapterProgress
from app.seed import seed_vocab, seed_chapters
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
        lesson_number=1,
        kanji="私",
        kana="わたし",
        romaji="watashi",
        meaning="I; me",
        jlpt_level="N5",
        part_of_speech="pronoun"
    )
    db_session.add(word)
    db_session.commit()
    db_session.refresh(word)

    assert word.id is not None
    assert word.lesson_number == 1

    progress = UserProgress(word_id=word.id, is_in_review=False, star_rating=1)
    db_session.add(progress)
    db_session.commit()
    db_session.refresh(word)

    assert word.progress is not None
    assert word.progress.star_rating == 1
    assert word.progress.is_in_review is False

def test_seed_chapters_initializes_25_lessons(db_session):
    """Verify that seed_chapters sets up all 25 lessons with Lesson 1 unlocked."""
    count = seed_chapters(db_session)
    assert count == 25

    chaps = db_session.query(ChapterProgress).order_by(ChapterProgress.lesson_number).all()
    assert len(chaps) == 25
    assert chaps[0].lesson_number == 1
    assert chaps[0].is_unlocked is True
    assert chaps[1].lesson_number == 2
    assert chaps[1].is_unlocked is False

def test_seed_vocab_populates_words_and_progress(db_session):
    """Verify that seed_vocab loads words and creates progress records."""
    count = seed_vocab(db_session, seed_file=settings.SEED_FILE)
    assert count > 0

    words = db_session.query(Word).all()
    assert len(words) == count

    # Ensure all have progress initialized
    progress_count = db_session.query(UserProgress).count()
    assert progress_count == count

    # Ensure idempotency
    second_run = seed_vocab(db_session, seed_file=settings.SEED_FILE)
    assert second_run == 0
