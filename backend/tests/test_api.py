import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db
from app.seed import seed_vocab
from app.config import settings

from sqlalchemy.pool import StaticPool

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

    # Seed data
    db = TestingSession()
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

def test_deck_summary(test_app):
    response = test_app.get("/api/decks/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_words"] == 50
    assert "star_distribution" in data
    assert data["unfamiliar_count"] == 50  # all start at 1 star

def test_quiz_next_and_submit(test_app):
    # 1. Fetch next question
    res_next = test_app.get("/api/quiz/next?level=N5")
    assert res_next.status_code == 200
    q = res_next.json()
    assert len(q["options"]) == 4
    assert q["word_id"] > 0
    assert q["current_stars"] == 1

    # 2. Get the correct word details from /words to submit correct answer
    res_word = test_app.get(f"/api/words/{q['word_id']}")
    assert res_word.status_code == 200
    correct_meaning = res_word.json()["meaning"]

    # 3. Submit correct answer
    res_submit = test_app.post("/api/quiz/submit", json={
        "word_id": q["word_id"],
        "selected_option": correct_meaning
    })
    assert res_submit.status_code == 200
    result = res_submit.json()
    assert result["is_correct"] is True
    assert result["star_rating_before"] == 1
    assert result["star_rating_after"] == 2
    assert result["correct_streak"] == 1

def test_quiz_submit_incorrect(test_app):
    res_next = test_app.get("/api/quiz/next?level=N4")
    assert res_next.status_code == 200
    q = res_next.json()

    res_submit = test_app.post("/api/quiz/submit", json={
        "word_id": q["word_id"],
        "selected_option": "THIS_IS_DEFINITELY_WRONG_123"
    })
    assert res_submit.status_code == 200
    result = res_submit.json()
    assert result["is_correct"] is False
    assert result["correct_streak"] == 0

def test_list_words_filtering(test_app):
    # Filter by N5
    res_n5 = test_app.get("/api/words?level=N5")
    assert res_n5.status_code == 200
    for w in res_n5.json():
        assert w["jlpt_level"] == "N5"

    # Search by keyword
    res_search = test_app.get("/api/words?search=eat")
    assert res_search.status_code == 200
    results = res_search.json()
    assert len(results) >= 1
    assert any("eat" in w["meaning"].lower() for w in results)

def test_ai_explanation(test_app):
    res = test_app.post("/api/ai/explain", json={
        "word": "食べる",
        "level": "N5",
        "meaning": "to eat"
    })
    assert res.status_code == 200
    data = res.json()
    assert "japanese_sentence" in data
    assert "grammar_breakdown" in data
    assert len(data["japanese_sentence"]) > 0

def test_deck_reset(test_app):
    res_reset = test_app.post("/api/decks/reset")
    assert res_reset.status_code == 200
    assert res_reset.json()["status"] == "success"

    # Verify all words are back to 1 star
    res_summary = test_app.get("/api/decks/summary")
    assert res_summary.json()["unfamiliar_count"] == 50
