from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    Float,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    func
)
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_guest = Column(Boolean, default=False, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String(100), nullable=True, index=True)
    reset_token = Column(String(100), nullable=True, index=True)
    reset_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    progress_records = relationship("UserProgress", back_populates="user", cascade="all, delete-orphan")
    review_logs = relationship("ReviewLog", back_populates="user", cascade="all, delete-orphan")
    chapter_records = relationship("ChapterProgress", back_populates="user", cascade="all, delete-orphan")
    quiz_logs = relationship("QuizLog", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', guest={self.is_guest})>"


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    daily_goal = Column(Integer, nullable=False, default=20)
    furigana_mode = Column(String(20), nullable=False, default="always")  # 'always', 'hover', 'off'
    audio_autoplay = Column(Boolean, nullable=False, default=True)
    theme = Column(String(20), nullable=False, default="dark")  # 'dark', 'light', 'nobunaga'
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="settings")


class Deck(Base):
    __tablename__ = "decks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    slug = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    name_ja = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(20), default="📖")
    color = Column(String(20), default="#E0F2FE")  # Pastel theme color
    jlpt_level = Column(String(10), default="N5", index=True)  # 'N5', 'N4'
    sort_order = Column(Integer, default=0)

    # Relationships
    words = relationship("Word", back_populates="deck")

    def __repr__(self):
        return f"<Deck(id={self.id}, name='{self.name}', level='{self.jlpt_level}')>"


class Word(Base):
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    deck_id = Column(Integer, ForeignKey("decks.id", ondelete="SET NULL"), nullable=True, index=True)
    lesson_number = Column(Integer, nullable=False, default=1, index=True)  # Minna no Nihongo Lesson 1-25
    book_title = Column(String(50), nullable=False, default="Minna no Nihongo I")
    kanji = Column(String(100), nullable=True, index=True)
    kana = Column(String(100), nullable=False, index=True)
    romaji = Column(String(100), nullable=False)
    meaning = Column(String(255), nullable=False)
    jlpt_level = Column(String(10), nullable=False, default="N5", index=True)  # 'N5', 'N4'
    part_of_speech = Column(String(50), nullable=False, default="noun", index=True)
    example_ja = Column(Text, nullable=True)
    example_en = Column(Text, nullable=True)
    mnemonic = Column(Text, nullable=True)

    # Relationships
    deck = relationship("Deck", back_populates="words")
    progress_records = relationship("UserProgress", back_populates="word", cascade="all, delete-orphan")
    review_logs = relationship("ReviewLog", back_populates="word", cascade="all, delete-orphan")
    quiz_logs = relationship("QuizLog", back_populates="word", cascade="all, delete-orphan")

    @property
    def progress(self):
        """Helper property for backward compatibility with single progress serializer."""
        return self.progress_records[0] if self.progress_records else None

    def __repr__(self):
        return f"<Word(id={self.id}, '{self.kana}', '{self.meaning}')>"


class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, default=1, index=True)
    word_id = Column(Integer, ForeignKey("words.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Study & Review Queue Status
    is_in_review = Column(Boolean, nullable=False, default=False, index=True)
    learned_at = Column(DateTime(timezone=True), nullable=True)
    user_notes = Column(Text, nullable=True)

    # Visible 5-Star mastery rating: 1 (Unfamiliar) to 5 (Mastered), derived from SM-2
    star_rating = Column(Integer, nullable=False, default=1, index=True)

    # SM-2 Spaced Repetition Scheduling Parameters
    repetitions = Column(Integer, nullable=False, default=0)
    interval_days = Column(Float, nullable=False, default=0.0)
    ease_factor = Column(Float, nullable=False, default=2.5)
    next_review_due = Column(DateTime(timezone=True), nullable=True, index=True)
    last_reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Performance & Streak Trackers
    total_attempts = Column(Integer, nullable=False, default=0)
    correct_attempts = Column(Integer, nullable=False, default=0)
    streak = Column(Integer, nullable=False, default=0)
    correct_streak = Column(Integer, nullable=False, default=0)  # Legacy alias

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        CheckConstraint("star_rating >= 1 AND star_rating <= 5", name="check_star_rating_range"),
        UniqueConstraint("user_id", "word_id", name="uq_user_word"),
    )

    # Relationships
    user = relationship("User", back_populates="progress_records")
    word = relationship("Word", back_populates="progress_records")

    @property
    def accuracy_rate(self) -> float:
        if self.total_attempts == 0:
            return 0.0
        return round((self.correct_attempts / self.total_attempts) * 100, 1)

    def __repr__(self):
        return f"<UserProgress(user={self.user_id}, word={self.word_id}, stars={self.star_rating}, interval={self.interval_days}d)>"


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    word_id = Column(Integer, ForeignKey("words.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(String(10), nullable=False)  # "again", "hard", "good", "easy"
    grade = Column(Integer, nullable=False)       # 1, 2, 3, 4
    interval_before = Column(Float, nullable=False)
    interval_after = Column(Float, nullable=False)
    ease_before = Column(Float, nullable=False)
    ease_after = Column(Float, nullable=False)
    stars_before = Column(Integer, nullable=False)
    stars_after = Column(Integer, nullable=False)
    response_time_ms = Column(Integer, default=0)
    reviewed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    # Relationships
    user = relationship("User", back_populates="review_logs")
    word = relationship("Word", back_populates="review_logs")

    def __repr__(self):
        return f"<ReviewLog(user={self.user_id}, word={self.word_id}, rating='{self.rating}')>"


# --- Legacy compatibility models ---
class ChapterProgress(Base):
    __tablename__ = "chapter_progress"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, default=1, index=True)
    lesson_number = Column(Integer, nullable=False, index=True)  # 1 to 25
    title = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    is_unlocked = Column(Boolean, nullable=False, default=False)
    unlocked_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "lesson_number", name="uq_user_lesson"),
    )

    user = relationship("User", back_populates="chapter_records")


class QuizLog(Base):
    __tablename__ = "quiz_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, default=1, index=True)
    word_id = Column(Integer, ForeignKey("words.id", ondelete="CASCADE"), nullable=False, index=True)
    selected_meaning = Column(String(255), nullable=False)
    is_correct = Column(Boolean, nullable=False)
    star_rating_before = Column(Integer, nullable=False)
    star_rating_after = Column(Integer, nullable=False)
    answered_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="quiz_logs")
    word = relationship("Word", back_populates="quiz_logs")
