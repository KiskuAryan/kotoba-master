from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field, ConfigDict

# --- Word Schemas ---
class WordBase(BaseModel):
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
    star_rating: int = Field(ge=1, le=5)
    correct_streak: int
    total_attempts: int
    correct_attempts: int
    accuracy_rate: float
    last_reviewed_at: Optional[datetime] = None

class WordOut(WordBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    progress: Optional[ProgressOut] = None

# --- Quiz Schemas ---
class QuizQuestionOut(BaseModel):
    word_id: int
    prompt_kanji: Optional[str] = None
    prompt_kana: str
    romaji: str
    jlpt_level: str
    part_of_speech: str
    current_stars: int
    options: List[str]  # 4 choices shuffled (1 correct, 3 distractors)

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
    example_ja: Optional[str] = None
    example_en: Optional[str] = None

# --- Deck & Statistics Schemas ---
class DeckStats(BaseModel):
    total_words: int
    mastered_count: int      # 5 stars
    familiar_count: int      # 3-4 stars
    learning_count: int      # 2 stars
    unfamiliar_count: int    # 1 star
    overall_accuracy: float
    total_reviews_done: int
    star_distribution: Dict[int, int]  # {1: X, 2: Y, 3: Z, 4: W, 5: V}
    level_counts: Dict[str, int]       # {"N5": X, "N4": Y}
