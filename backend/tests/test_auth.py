import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.main import app
from app.seed import seed_chapters, seed_vocab
from app.auth import ensure_demo_user

@pytest.fixture
def auth_client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine)
    db = TestingSessionLocal()
    ensure_demo_user(db)
    seed_chapters(db, user_id=1)
    seed_vocab(db, user_id=1)
    db.close()

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_user_registration_and_login(auth_client):
    # 1. Register User Kenji
    res = auth_client.post("/api/auth/register", json={
        "username": "kenji",
        "email": "kenji@example.com",
        "password": "password123"
    })
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["user"]["username"] == "kenji"
    kenji_token = data["access_token"]

    # 2. Reject duplicate registration
    res_dup = auth_client.post("/api/auth/register", json={
        "username": "kenji",
        "email": "another@example.com",
        "password": "password123"
    })
    assert res_dup.status_code == 400

    # 3. Login with credentials
    res_login = auth_client.post("/api/auth/login", json={
        "username_or_email": "kenji",
        "password": "password123"
    })
    assert res_login.status_code == 200
    login_data = res_login.json()
    assert login_data["access_token"] is not None

    # 4. Reject bad password
    res_bad = auth_client.post("/api/auth/login", json={
        "username_or_email": "kenji",
        "password": "wrongpassword"
    })
    assert res_bad.status_code == 401

    # 5. Access profile with token
    res_me = auth_client.get("/api/auth/me", headers={"Authorization": f"Bearer {kenji_token}"})
    assert res_me.status_code == 200
    assert res_me.json()["username"] == "kenji"


def test_multi_user_progress_isolation(auth_client):
    """Verify that User A's progress and review queue are strictly separated from User B."""
    # Register User A (Alice)
    res_a = auth_client.post("/api/auth/register", json={
        "username": "alice",
        "email": "alice@example.com",
        "password": "password123"
    })
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Register User B (Bob)
    res_b = auth_client.post("/api/auth/register", json={
        "username": "bob",
        "email": "bob@example.com",
        "password": "password123"
    })
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Alice adds Word 1 to her review queue
    res_toggle_a = auth_client.post("/api/chapters/toggle-review", json={
        "word_id": 1,
        "is_in_review": True
    }, headers=headers_a)
    assert res_toggle_a.status_code == 200

    # Check Alice's status: total_in_review == 1
    res_status_a = auth_client.get("/api/quiz/status", headers=headers_a)
    assert res_status_a.status_code == 200
    assert res_status_a.json()["total_in_review"] == 1

    # Bob's status must still be EMPTY (0 in review)
    res_status_b = auth_client.get("/api/quiz/status", headers=headers_b)
    assert res_status_b.status_code == 200
    assert res_status_b.json()["total_in_review"] == 0

    # Bob adds Chapter 1 all words to review
    res_add_all_b = auth_client.post("/api/chapters/1/add-all-to-review", headers=headers_b)
    assert res_add_all_b.status_code == 200

    # Verify Bob now has chapter words in review, while Alice still has only 1 word
    res_status_b2 = auth_client.get("/api/quiz/status", headers=headers_b)
    assert res_status_b2.json()["total_in_review"] > 1

    res_status_a2 = auth_client.get("/api/quiz/status", headers=headers_a)
    assert res_status_a2.json()["total_in_review"] == 1
