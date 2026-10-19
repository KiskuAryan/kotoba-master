from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models import User, ChapterProgress
from app.schemas import UserRegister, UserLogin, UserOut, TokenResponse
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_required,
    get_current_user_optional
)
from app.seed import CHAPTER_METADATA

router = APIRouter(prefix="/auth", tags=["Authentication"])

def init_user_chapters(db: Session, user_id: int):
    """Initializes the 25 Minna no Nihongo curriculum chapters for a newly registered user."""
    for lesson_num, title, desc in CHAPTER_METADATA:
        existing = db.query(ChapterProgress).filter_by(user_id=user_id, lesson_number=lesson_num).first()
        if not existing:
            chap = ChapterProgress(
                user_id=user_id,
                lesson_number=lesson_num,
                title=title,
                description=desc,
                is_unlocked=(lesson_num == 1),
                unlocked_at=datetime.now(timezone.utc) if lesson_num == 1 else None
            )
            db.add(chap)
    db.commit()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserRegister, db: Session = Depends(get_db)):
    """Registers a new user and returns their JWT access token."""
    username = payload.username.strip().lower()
    email = payload.email.strip().lower()

    if db.query(User).filter(User.username == username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already taken. Please choose another."
        )

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is already registered. Please sign in."
        )

    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(payload.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Initialize this user's 25 chapters
    init_user_chapters(db, user.id)

    token = create_access_token(user.id, user.username)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )


@router.post("/login", response_model=TokenResponse)
def login_user(payload: UserLogin, db: Session = Depends(get_db)):
    """Logs in an existing user and returns their JWT access token."""
    identifier = payload.username_or_email.strip().lower()

    user = db.query(User).filter(
        or_(User.username == identifier, User.email == identifier)
    ).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please check your username/email and password."
        )

    token = create_access_token(user.id, user.username)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )


@router.get("/me", response_model=UserOut)
def get_current_user_profile(user: User = Depends(get_current_user_required)):
    """Returns the authenticated user's profile."""
    return UserOut.model_validate(user)
