import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.database import Base, get_db
from app.seed import seed_vocab, seed_chapters
from app.models import UserProgress, Word, ChapterProgress
from app.config import settings

@pytest.fixture(scope="module")
def test_app():
    # Setup shared in-memory test database with StaticPool
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Seed chapters and vocabulary
    db = TestingSession()
    seed_chapters(db)
    seed_vocab(db, seed_file=settings.SEED_FILE)
    db.close()

    def override_get_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

def test_health_check(test_app):
    response = test_app.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_frontend_serving(test_app):
    res_index = test_app.get("/")
    assert res_index.status_code == 200
    assert "KotobaMaster" in res_index.text

    res_css = test_app.get("/static/css/styles.css")
    assert res_css.status_code == 200
    assert "--bg-primary" in res_css.text

def test_chapters_list(test_app):
    response = test_app.get("/api/chapters")
    assert response.status_code == 200
    chaps = response.json()
    assert len(chaps) == 25
    assert chaps[0]["lesson_number"] == 1
    assert chaps[0]["is_unlocked"] is True
    assert chaps[1]["lesson_number"] == 2
    assert chaps[1]["is_unlocked"] is False

def test_get_chapter_words(test_app):
    response = test_app.get("/api/chapters/1/words")
    assert response.status_code == 200
    words = response.json()
    assert len(words) > 0
    assert all(w["lesson_number"] == 1 for w in words)

def test_add_to_review_queue(test_app):
    # 1. Initially quiz queue might be empty if no words are in review
    res_words = test_app.get("/api/chapters/1/words")
    first_word_id = res_words.json()[0]["id"]

    # Toggle word into review
    res_toggle = test_app.post("/api/chapters/toggle-review", json={
        "word_id": first_word_id,
        "is_in_review": True
    })
    assert res_toggle.status_code == 200
    assert res_toggle.json()["is_in_review"] is True

    # Batch add all chapter 1 words to review
    res_batch = test_app.post("/api/chapters/1/add-all-to-review")
    assert res_batch.status_code == 200
    assert res_batch.json()["added_count"] > 0

def test_quiz_status_and_session_batching(test_app):
    # Check status
    res_status = test_app.get("/api/quiz/status")
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert status_data["total_in_review"] > 0

    # Start a finite review session batch (size 5)
    res_session = test_app.get("/api/quiz/session?size=5")
    assert res_session.status_code == 200
    session_data = res_session.json()
    assert session_data["total_questions"] <= 5
    assert len(session_data["questions"]) > 0

    # Verify no duplicate word IDs in the same session batch
    word_ids = [q["word_id"] for q in session_data["questions"]]
    assert len(word_ids) == len(set(word_ids))  # Every word appears ONCE per session
    for q in session_data["questions"]:
        assert "is_retention_check" in q

def test_quiz_with_review_queue(test_app):
    # Fetch next question from review queue
    res_next = test_app.get("/api/quiz/next?only_in_review=true")
    assert res_next.status_code == 200
    q = res_next.json()
    assert len(q["options"]) == 4
    assert q["word_id"] > 0

    # Get correct meaning
    res_word = test_app.get(f"/api/words/{q['word_id']}")
    correct_meaning = res_word.json()["meaning"]

    # Submit correct answer
    res_submit = test_app.post("/api/quiz/submit", json={
        "word_id": q["word_id"],
        "selected_option": correct_meaning
    })
    assert res_submit.status_code == 200
    res_data = res_submit.json()
    assert res_data["is_correct"] is True
    assert res_data["correct_streak"] >= 1

def test_chapter_unlock_progression(test_app):
    # Check unlock status for chapter 1
    res = test_app.post("/api/chapters/1/check-unlock")
    assert res.status_code == 200
    data = res.json()
    assert "current_lesson" in data
    assert "mastery_percentage" in data
