import json
from pathlib import Path
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.database import engine, SessionLocal, Base
from app.models import Word, UserProgress, ChapterProgress
from app.config import settings

CHAPTER_METADATA = [
    (1, "Lesson 1: Self-Introductions & Occupations", "自己紹介・職業 (わたし、あなた、がくせい)"),
    (2, "Lesson 2: Everyday Objects & Demonstratives", "指示詞・物 (これ、それ、ほん、じしょ)"),
    (3, "Lesson 3: Places & Directions", "場所・方向 (ここ、そこ、どこ、かいぎしつ)"),
    (4, "Lesson 4: Time, Daily Routine & Verbs", "時間・日常動詞 (おきます、ねます、やすみ)"),
    (5, "Lesson 5: Transportation & Going Places", "移動・交通手段 (いきます、きます、でんしゃ)"),
    (6, "Lesson 6: Food, Drink & Daily Actions", "飲食・生活動作 (たべます、のみます、みせ)"),
    (7, "Lesson 7: Tools, Means, Gifts & Languages", "手段・贈答 (はし、パソコン、あげます)"),
    (8, "Lesson 8: Adjectives (i- & na-adjectives)", "形容詞 (きれい、おもしろい、あたらしい)"),
    (9, "Lesson 9: Preferences, Skills & Possession", "嗜好・能力・所有 (すき、きらい、わかります)"),
    (10, "Lesson 10: Existence of People & Objects", "存在・位置 (あります、います、うえ、した)"),
    (11, "Lesson 11: Counters, Quantities & Duration", "助数詞・期間 (ひとつ、ふたつ、まい、じかん)"),
    (12, "Lesson 12: Past Tense & Comparisons", "比較・過去形 (きのう、〜のほうが、いちばん)"),
    (13, "Lesson 13: Desires & Purposes of Action", "願望・目的 (ほしい、〜たい、あそびにいく)"),
    (14, "Lesson 14: Te-Form: Requests & In-Progress", "て形・指示 (〜てください、〜ています)"),
    (15, "Lesson 15: Te-Form: Permission & Prohibition", "許可・禁止 (〜てもいいですか、いけません)"),
    (16, "Lesson 16: Te-Form: Action Sequences", "動作の連続 (〜てから、どうやって)"),
    (17, "Lesson 17: Nai-Form: Obligation & Negative", "ない形・義務 (〜なければなりません)"),
    (18, "Lesson 18: Dictionary Form: Ability & Hobbies", "辞書形・可能・趣味 (〜ことができます)"),
    (19, "Lesson 19: Ta-Form: Past Experiences", "た形・経験 (〜たことがあります)"),
    (20, "Lesson 20: Plain Form: Casual Conversations", "普通形 (話す、行く、だ、じゃない)"),
    (21, "Lesson 21: Expressing Opinions & Quotations", "意見・引用 (〜とおもいます、いいました)"),
    (22, "Lesson 22: Noun-Modifying Relative Clauses", "連体修飾 (〜しているひと、つくったもの)"),
    (23, "Lesson 23: Conditionals: 'When' & 'If'", "時・条件 (〜とき、〜と)"),
    (24, "Lesson 24: Giving & Receiving Favors", "授受動詞 (〜てくれます、〜てもらいます)"),
    (25, "Lesson 25: Hypothetical & Concessive", "仮定・逆接 (〜たら、〜ても)")
]

def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=engine)

def seed_chapters(db: Session) -> int:
    """Initialize all 25 Minna no Nihongo chapters. Chapter 1 is unlocked by default."""
    inserted = 0
    for lesson_num, title, desc in CHAPTER_METADATA:
        existing = db.query(ChapterProgress).filter_by(lesson_number=lesson_num).first()
        if not existing:
            chap = ChapterProgress(
                lesson_number=lesson_num,
                title=title,
                description=desc,
                is_unlocked=(lesson_num == 1),  # Only Chapter 1 unlocked initially
                unlocked_at=datetime.now(timezone.utc) if lesson_num == 1 else None
            )
            db.add(chap)
            inserted += 1
    db.commit()
    return inserted

def seed_vocab(db: Session, seed_file: Path = None) -> int:
    """Seeds vocabulary words and their initial user progress."""
    if seed_file is None:
        seed_file = settings.SEED_FILE

    if not seed_file.exists():
        raise FileNotFoundError(f"Seed file not found: {seed_file}")

    with open(seed_file, "r", encoding="utf-8") as f:
        vocab_list = json.load(f)

    inserted_count = 0
    for item in vocab_list:
        existing = db.query(Word).filter(
            Word.kana == item["kana"],
            Word.meaning == item["meaning"]
        ).first()

        if not existing:
            word = Word(
                lesson_number=item.get("lesson_number", 1),
                book_title="Minna no Nihongo I",
                kanji=item.get("kanji"),
                kana=item["kana"],
                romaji=item["romaji"],
                meaning=item["meaning"],
                jlpt_level=item.get("jlpt_level", "N5"),
                part_of_speech=item.get("part_of_speech", "noun"),
                example_ja=item.get("example_ja"),
                example_en=item.get("example_en"),
            )
            db.add(word)
            db.flush()

            # Initialize 1-star progress; initially not in review queue
            progress = UserProgress(
                word_id=word.id,
                is_in_review=False,
                star_rating=1,
                correct_streak=0,
                total_attempts=0,
                correct_attempts=0
            )
            db.add(progress)
            inserted_count += 1

    db.commit()
    return inserted_count

if __name__ == "__main__":
    init_db()
    db = SessionLocal()
    try:
        c_count = seed_chapters(db)
        v_count = seed_vocab(db)
        print(f"Initialized {c_count} chapters and seeded {v_count} Minna no Nihongo vocabulary words!")
    finally:
        db.close()
