from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

# ==================== AUTH SCHEMAS ====================
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
    is_guest: bool = False
    is_verified: bool = False
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=5, max_length=100)

class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10)
    new_password: str = Field(min_length=6, max_length=100)

class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=10)

class MessageResponse(BaseModel):
    message: str
    success: bool = True
    dev_token: Optional[str] = None


# ==================== USER SETTINGS SCHEMAS ====================
class UserSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    daily_goal: int = 20
    furigana_mode: str = "always"
    audio_autoplay: bool = True
    theme: str = "dark"

class UserSettingsUpdate(BaseModel):
    daily_goal: Optional[int] = Field(None, ge=5, le=100)
    furigana_mode: Optional[str] = None  # 'always', 'hover', 'off'
    audio_autoplay: Optional[bool] = None
    theme: Optional[str] = None


# ==================== DECK SCHEMAS ====================
class DeckBase(BaseModel):
    slug: str
    name: str
    name_ja: str
    title: Optional[str] = None
    japanese_title: Optional[str] = None
    description: Optional[str] = None
    icon: str = "📖"
    color: str = "#E0F2FE"
    jlpt_level: str = "N5"
    level: Optional[str] = None
    sort_order: int = 0

class DeckOut(DeckBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    total_words: int = 0
    word_count: Optional[int] = 0
    words_in_review: int = 0
    mastered_words: int = 0
    mastery_percentage: float = 0.0
    due_count: int = 0


# ==================== WORD & PROGRESS SCHEMAS ====================
class WordBase(BaseModel):
    deck_id: Optional[int] = None
    lesson_number: int = 1
    book_title: str = "Minna no Nihongo I"
    kanji: Optional[str] = None
    kana: str
    romaji: str
    meaning: str
    jlpt_level: str
    level: Optional[str] = None
    part_of_speech: str
    example_ja: Optional[str] = None
    example_en: Optional[str] = None
    example_sentence: Optional[str] = None
    example_translation: Optional[str] = None
    mnemonic: Optional[str] = None

class WordCreate(WordBase):
    pass

class ProgressOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    word_id: int
    is_in_review: bool
    learned_at: Optional[datetime] = None
    star_rating: int = Field(ge=1, le=5)
    repetitions: int = 0
    interval_days: float = 0.0
    ease_factor: float = 2.5
    streak: int = 0
    correct_streak: int = 0
    total_attempts: int = 0
    correct_attempts: int = 0
    accuracy_rate: float = 0.0
    last_reviewed_at: Optional[datetime] = None
    next_review_due: Optional[datetime] = None
    user_notes: Optional[str] = None

class WordOut(WordBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    stars: int = 1
    is_in_review: bool = False
    user_notes: Optional[str] = None
    progress: Optional[ProgressOut] = None

class WordDetailOut(WordOut):
    deck_name: Optional[str] = None


# ==================== REVIEW & SM-2 SCHEMAS ====================
class ReviewDueItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[int] = None
    word_id: int
    deck_id: Optional[int] = None
    deck_name: Optional[str] = None
    kanji: Optional[str] = None
    kana: str
    romaji: str
    meaning: str
    jlpt_level: str
    level: Optional[str] = None
    part_of_speech: str
    example_ja: Optional[str] = None
    example_en: Optional[str] = None
    example_sentence: Optional[str] = None
    example_translation: Optional[str] = None
    mnemonic: Optional[str] = None
    star_rating: int = 1
    stars: int = 1
    repetitions: int = 0
    interval_days: float = 0.0
    ease_factor: float = 2.5
    next_review_due: Optional[datetime] = None
    is_overdue: bool = False
    options: List[str] = []

class ReviewSubmitRequest(BaseModel):
    word_id: int
    rating: Optional[str] = Field(default=None, description="'again', 'hard', 'good', 'easy', 'correct', or 'incorrect'")
    selected_option: Optional[str] = None
    is_correct: Optional[bool] = None
    response_time_ms: Optional[int] = 0

class ReviewSubmitResponse(BaseModel):
    word_id: int
    rating: str
    grade: int
    is_correct: bool
    correct_meaning: Optional[str] = None
    star_rating_before: int
    star_rating_after: int
    stars: Optional[int] = None
    newStars: Optional[int] = None
    repetitions: int
    interval_days: float
    ease_factor: float
    streak: int
    next_review_due: datetime
    message: str


# ==================== STATS SCHEMAS ====================
class HeatmapItem(BaseModel):
    date: str  # YYYY-MM-DD
    count: int
    accuracy: float

class DueForecastItem(BaseModel):
    date: str  # YYYY-MM-DD
    due_count: int
    cumulative_due: int

class StatsResponse(BaseModel):
    total_words: int
    words_in_review: int
    mastered_count: int
    overall_accuracy: float
    total_reviews_done: int
    current_streak: int
    longest_streak: int
    star_distribution: Dict[int, int]
    heatmap: List[HeatmapItem]
    accuracy_trend: List[Dict[str, Any]]
    due_forecast: List[DueForecastItem]


# ==================== BACKWARD COMPATIBILITY SCHEMAS ====================
class ChapterOut(BaseModel):
    lesson_number: int
    title: str
    description: Optional[str] = None
    is_unlocked: bool
    total_words: int
    words_in_review: int
    mastery_percentage: float
    can_unlock: bool
    required_mastery: float = 70.0
    prev_lesson_mastery: Optional[float] = None

class ToggleReviewRequest(BaseModel):
    word_id: int
    is_in_review: bool = True

class ToggleReviewResponse(BaseModel):
    word_id: int
    is_in_review: bool
    message: str

class QuizQuestionOut(BaseModel):
    word_id: int
    lesson_number: int
    prompt_kanji: Optional[str] = None
    prompt_kana: str
    romaji: str
    jlpt_level: str
    part_of_speech: str
    current_stars: int
    options: List[str]
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
    chapter_unlocked: Optional[int] = None
    example_ja: Optional[str] = None
    example_en: Optional[str] = None

class DeckStats(BaseModel):
    total_words: int
    words_in_review: int
    mastered_count: int
    familiar_count: int
    learning_count: int
    unfamiliar_count: int
    overall_accuracy: float
    total_reviews_done: int
    star_distribution: Dict[int, int]
    level_counts: Dict[str, int]
    chapter_mastery: Dict[int, float]
