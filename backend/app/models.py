from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    CheckConstraint,
    func
)
from sqlalchemy.orm import relationship
from app.database import Base

class Word(Base):
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    kanji = Column(String(100), nullable=True, index=True)
    kana = Column(String(100), nullable=False, index=True)
    romaji = Column(String(100), nullable=False)
    meaning = Column(String(255), nullable=False)
    jlpt_level = Column(String(10), nullable=False, index=True)  # e.g., 'N5', 'N4'
    part_of_speech = Column(String(50), nullable=False, index=True)  # 'noun', 'verb', 'adjective', etc.
    example_ja = Column(Text, nullable=True)
    example_en = Column(Text, nullable=True)

    # Relationships
    progress = relationship("UserProgress", back_populates="word", uselist=False, cascade="all, delete-orphan")
    quiz_logs = relationship("QuizLog", back_populates="word", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Word(id={self.id}, kanji='{self.kanji}', kana='{self.kana}', meaning='{self.meaning}', level='{self.jlpt_level}')>"


class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    word_id = Column(Integer, ForeignKey("words.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    
    # 5-Star mastery rating: 1 (Unfamiliar) to 5 (Mastered)
    star_rating = Column(Integer, nullable=False, default=1, index=True)
    correct_streak = Column(Integer, nullable=False, default=0)
    total_attempts = Column(Integer, nullable=False, default=0)
    correct_attempts = Column(Integer, nullable=False, default=0)
    last_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        CheckConstraint("star_rating >= 1 AND star_rating <= 5", name="check_star_rating_range"),
    )

    # Relationship
    word = relationship("Word", back_populates="progress")

    @property
    def accuracy_rate(self) -> float:
        if self.total_attempts == 0:
            return 0.0
        return round((self.correct_attempts / self.total_attempts) * 100, 1)

    def __repr__(self):
        return f"<UserProgress(word_id={self.word_id}, stars={self.star_rating}, streak={self.correct_streak})>"


class QuizLog(Base):
    __tablename__ = "quiz_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    word_id = Column(Integer, ForeignKey("words.id", ondelete="CASCADE"), nullable=False, index=True)
    selected_meaning = Column(String(255), nullable=False)
    is_correct = Column(Boolean, nullable=False)
    star_rating_before = Column(Integer, nullable=False)
    star_rating_after = Column(Integer, nullable=False)
    answered_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationship
    word = relationship("Word", back_populates="quiz_logs")

    def __repr__(self):
        return f"<QuizLog(word_id={self.word_id}, correct={self.is_correct}, stars={self.star_rating_before}->{self.star_rating_after})>"
