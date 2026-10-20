import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.main import app
from app.seed_themed import seed_database
from app.seed import seed_chapters
from app.auth import ensure_demo_user

@pytest.fixture
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine)

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    # Seed in-memory database
    db = TestingSessionLocal()
    demo_user = ensure_demo_user(db)
    seed_chapters(db, user_id=1)
    db.close()

    # Run seed_themed logic on in-memory db
    from app.models import Deck, Word, UserProgress
    db = TestingSessionLocal()
    d1 = Deck(slug="n5-daily-essentials", name="Daily Essentials", name_ja="日常会話", jlpt_level="N5", sort_order=1)
    d2 = Deck(slug="n4-work-tech", name="Work & Tech", name_ja="職場", jlpt_level="N4", sort_order=2)
    db.add_all([d1, d2])
    db.flush()

    w1 = Word(deck_id=d1.id, kana="わたし", romaji="watashi", meaning="I; me", jlpt_level="N5", part_of_speech="pronoun")
    w2 = Word(deck_id=d1.id, kana="あなた", romaji="anata", meaning="you", jlpt_level="N5", part_of_speech="pronoun")
    w3 = Word(deck_id=d2.id, kana="かいしゃ", romaji="kaisha", meaning="company", jlpt_level="N4", part_of_speech="noun")
    db.add_all([w1, w2, w3])
    db.flush()

    p1 = UserProgress(user_id=1, word_id=w1.id, is_in_review=True, star_rating=1)
    p2 = UserProgress(user_id=1, word_id=w2.id, is_in_review=False, star_rating=1)
    db.add_all([p1, p2])
    db.commit()
    db.close()

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


def test_guest_mode_auth(client):
    """Verify anonymous guest login returns a valid JWT and creates an isolated guest."""
    res = client.post("/api/auth/guest")
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["user"]["is_guest"] is True
    assert data["user"]["username"].startswith("guest_")

    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify guest profile access
    res_me = client.get("/api/auth/me", headers=headers)
    assert res_me.status_code == 200
    assert res_me.json()["is_guest"] is True


def test_decks_listing_and_queue(client):
    """Test deck listing with user metrics and adding deck to review queue."""
    res = client.get("/api/decks")
    assert res.status_code == 200
    decks = res.json()
    assert len(decks) >= 2
    deck1 = next(d for d in decks if d["slug"] == "n5-daily-essentials")
    assert deck1["total_words"] == 2
    assert deck1["word_count"] == 2
    assert deck1["title"] == deck1["name"]
    assert deck1["japanese_title"] == deck1["name_ja"]
    assert deck1["level"] == "N5"
    assert deck1["words_in_review"] == 1

    # Add all words of deck 1 to review queue
    res_add = client.post(f"/api/decks/{deck1['id']}/add-to-queue")
    assert res_add.status_code == 200
    assert res_add.json()["success"] is True

    # Check deck detail
    res_detail = client.get(f"/api/decks/{deck1['id']}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["words_in_review"] == 2
    assert len(detail["words"]) == 2
    assert detail["title"] == "Daily Essentials"
    assert detail["word_count"] == 2
    assert detail["level"] == "N5"
    assert detail["words"][0]["stars"] == 1
    assert detail["words"][0]["level"] == "N5"


def test_words_search_and_notes(client):
    """Test word search, detail, and user personal notes."""
    res = client.get("/api/words?search=watashi")
    assert res.status_code == 200
    words = res.json()
    assert len(words) == 1
    assert words[0]["kana"] == "わたし"
    word_id = words[0]["id"]

    # Save personal notes
    res_notes = client.put(f"/api/words/{word_id}/notes", json={"notes": "My personal mnemonic"})
    assert res_notes.status_code == 200
    assert res_notes.json()["success"] is True

    # Retrieve word detail
    res_word = client.get(f"/api/words/{word_id}")
    assert res_word.status_code == 200
    detail = res_word.json()
    assert detail["progress"]["user_notes"] == "My personal mnemonic"


def test_reviews_due_and_submit_lifecycle(client):
    """Test fetching due review cards and submitting ratings."""
    # 1. Fetch due cards
    res_due = client.get("/api/reviews/due")
    assert res_due.status_code == 200
    due_data = res_due.json()
    assert due_data["due_count"] >= 1
    cards = due_data["cards"]
    assert len(cards) >= 1
    target_card = cards[0]
    word_id = target_card["word_id"]

    # 2. Submit Good rating
    res_good = client.post("/api/reviews/submit", json={
        "word_id": word_id,
        "rating": "good",
        "response_time_ms": 1400
    })
    assert res_good.status_code == 200
    good_res = res_good.json()
    assert good_res["is_correct"] is True
    assert good_res["grade"] == 3
    assert good_res["repetitions"] == 1
    assert good_res["interval_days"] == 1.0

    # 3. Submit Easy rating
    res_easy = client.post("/api/reviews/submit", json={
        "word_id": word_id,
        "rating": "easy",
        "response_time_ms": 800
    })
    assert res_easy.status_code == 200
    easy_res = res_easy.json()
    assert easy_res["repetitions"] == 2
    assert easy_res["interval_days"] == 7.0
    assert easy_res["star_rating_after"] == 3

    # 4. Submit Again rating (should reset)
    res_again = client.post("/api/reviews/submit", json={
        "word_id": word_id,
        "rating": "again",
        "response_time_ms": 3000
    })
    assert res_again.status_code == 200
    again_res = res_again.json()
    assert again_res["is_correct"] is False
    assert again_res["repetitions"] == 0
    assert again_res["interval_days"] == 1.0
    assert again_res["star_rating_after"] == 1


def test_stats_analytics(client):
    """Test /api/stats endpoint for heatmap, streak, and due forecast."""
    # Submit a review to generate log data
    client.post("/api/reviews/submit", json={"word_id": 1, "rating": "good"})

    res = client.get("/api/stats")
    assert res.status_code == 200
    stats = res.json()
    assert "total_words" in stats
    assert "star_distribution" in stats
    assert "heatmap" in stats
    assert len(stats["heatmap"]) == 366  # 365 days + today
    assert "due_forecast" in stats
    assert len(stats["due_forecast"]) == 14
    assert stats["total_reviews_done"] >= 1


def test_settings_export_and_import(client):
    """Test user settings update, data export, and data restore."""
    # 1. Update settings
    res_put = client.put("/api/settings", json={
        "daily_goal": 35,
        "furigana_mode": "hover",
        "theme": "nobunaga"
    })
    assert res_put.status_code == 200
    st = res_put.json()
    assert st["daily_goal"] == 35
    assert st["furigana_mode"] == "hover"
    assert st["theme"] == "nobunaga"

    # 2. Export data
    res_export = client.get("/api/settings/export")
    assert res_export.status_code == 200
    export_payload = res_export.json()
    assert "progress" in export_payload
    assert "settings" in export_payload
    assert export_payload["settings"]["daily_goal"] == 35

    # 3. Import data
    res_import = client.post("/api/settings/import", json=export_payload)
    assert res_import.status_code == 200
    assert res_import.json()["success"] is True
