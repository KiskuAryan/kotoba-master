import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models import User, ChapterProgress
from app.schemas import (
    UserRegister,
    UserLogin,
    UserOut,
    TokenResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
    MessageResponse
)
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_required,
    get_current_user_optional
)
from app.seed import CHAPTER_METADATA
from app.mail_service import (
    send_welcome_email,
    send_login_notification,
    send_password_reset_email,
    get_dev_emails
)
from app.config import settings

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
    """Registers a new user, sends a welcome/confirmation email, and returns their JWT access token."""
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

    verification_token = secrets.token_urlsafe(32)
    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(payload.password),
        verification_token=verification_token,
        is_verified=False
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Initialize this user's 25 chapters
    init_user_chapters(db, user.id)

    # Send welcome / confirmation email
    try:
        send_welcome_email(user.email, user.username, verification_token)
    except Exception:
        pass  # Never let email delivery failure block registration

    token = create_access_token(user.id, user.username)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )


@router.post("/login", response_model=TokenResponse)
def login_user(payload: UserLogin, request: Request, db: Session = Depends(get_db)):
    """Logs in an existing user, sends a login confirmation email, and returns their JWT access token."""
    identifier = payload.username_or_email.strip().lower()

    user = db.query(User).filter(
        or_(User.username == identifier, User.email == identifier)
    ).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please check your username/email and password."
        )

    # Update last login timestamp
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    # Send login confirmation / security notification email
    client_ip = request.client.host if request.client else "Unknown IP"
    user_agent = request.headers.get("user-agent", "Unknown Client")
    try:
        send_login_notification(user.email, user.username, client_ip, user_agent)
    except Exception:
        pass  # Do not block login if mail dispatch fails

    token = create_access_token(user.id, user.username)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Initiates password reset by generating a secure time-limited token
    and sending reset instructions to the requested email.
    """
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    dev_token = None
    if user:
        reset_token = secrets.token_urlsafe(32)
        user.reset_token = reset_token
        user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        db.commit()

        try:
            send_password_reset_email(user.email, user.username, reset_token)
        except Exception:
            pass

        # If running in local dev mode without live SMTP, supply token for instant developer convenience
        if not settings.SMTP_HOST:
            dev_token = reset_token

    return MessageResponse(
        message="If an account with that email exists, password reset instructions have been sent to your inbox.",
        success=True,
        dev_token=dev_token
    )


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Resets the user's password using the one-time token."""
    user = db.query(User).filter(User.reset_token == payload.token).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token."
        )

    # Check token expiration (1 hour)
    expires_at = user.reset_token_expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if not expires_at or expires_at < datetime.now(timezone.utc):
        user.reset_token = None
        user.reset_token_expires_at = None
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset token has expired. Please request a new one."
        )

    # Set new password and invalidate token
    user.hashed_password = hash_password(payload.new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.commit()

    return MessageResponse(
        message="Your password has been successfully reset. You can now sign in with your new password.",
        success=True
    )


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    """Verifies a user's email address using the verification token."""
    user = db.query(User).filter(User.verification_token == payload.token).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token."
        )

    user.is_verified = True
    user.verification_token = None
    db.commit()

    return MessageResponse(
        message="Your email address has been verified successfully! ようこそ！",
        success=True
    )


@router.get("/me", response_model=UserOut)
def get_current_user_profile(user: User = Depends(get_current_user_required)):
    """Returns the authenticated user's profile."""
    return UserOut.model_validate(user)


@router.get("/dev-emails", response_model=List[Dict[str, Any]])
def list_dev_emails():
    """Returns recent development emails for local testing and inspection."""
    return get_dev_emails()
