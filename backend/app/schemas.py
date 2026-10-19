from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field, ConfigDict

# --- Auth Schemas ---
class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: str = Field(min_length=5, max_length=100)
    password: str = Field(min_length=6, max_length=100)

class UserLogin(BaseModel):
    username_or_email: str
    password: str

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    created_at: Optional[datetime] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# --- Word Schemas ---
class WordBase(BaseModel):
    lesson_number: int = 1
    book_title: str = "Minna no Nihongo I"
    kanji: Optional[str] = None
    kana: str
    romaji: str
    meaning: str
    jlpt_level: str
    part_of_speech: str
    example_ja: Optional[str] = None
    example_en: Optional[str] = None

class WordCreate(WordBase):
    pass

class ProgressOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    word_id: int
    is_in_review: bool
    learned_at: Optional[datetime] = None
    star_rating: int = Field(ge=1, le=5)
    correct_streak: int
    total_attempts: int
    correct_attempts: int
    accuracy_rate: float
    last_reviewed_at: Optional[datetime] = None
    next_review_due: Optional[datetime] = None

class WordOut(WordBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    progress: Optional[ProgressOut] = None

# --- Chapter / Lesson Schemas ---
class ChapterOut(BaseModel):
    lesson_number: int
    title: str
    description: Optional[str] = None
    is_unlocked: bool
    total_words: int
    words_in_review: int
    mastery_percentage: float
    can_unlock: bool

# --- Review Queue Schemas ---
class ToggleReviewRequest(BaseModel):
    word_id: int
    is_in_review: bool = True

class ToggleReviewResponse(BaseModel):
    word_id: int
    is_in_review: bool
    message: str

# --- Quiz Schemas ---
class QuizQuestionOut(BaseModel):
    word_id: int
    lesson_number: int
    prompt_kanji: Optional[str] = None
    prompt_kana: str
    romaji: str
    jlpt_level: str
    part_of_speech: str
    current_stars: int
    options: List[str]  # 4 choices shuffled (1 correct, 3 distractors)
    is_retention_check: bool = False

class QuizStatusOut(BaseModel):
    due_count: int
    total_in_review: int
    next_due_in_minutes: Optional[int] = None
    can_early_practice: bool

class QuizSessionOut(BaseModel):
    total_questions: int
    is_early_practice: bool
    due_count: int
    questions: List[QuizQuestionOut]

class QuizAnswerSubmit(BaseModel):
    word_id: int
    selected_option: str

class QuizAnswerResult(BaseModel):
    word_id: int
    is_correct: bool
    correct_meaning: str
    star_rating_before: int
    star_rating_after: int
    correct_streak: int
    star_change: int
    chapter_unlocked: Optional[int] = None  # lesson_number if this answer unlocked next chapter
    example_ja: Optional[str] = None
    example_en: Optional[str] = None

# --- Deck & Statistics Schemas ---
class DeckStats(BaseModel):
    total_words: int
    words_in_review: int
    mastered_count: int      # 5 stars
    familiar_count: int      # 3-4 stars
    learning_count: int      # 2 stars
    unfamiliar_count: int    # 1 star
    overall_accuracy: float
    total_reviews_done: int
    star_distribution: Dict[int, int]
    level_counts: Dict[str, int]
    chapter_mastery: Dict[int, float]
