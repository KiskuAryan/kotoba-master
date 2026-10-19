import json
from pathlib import Path
from sqlalchemy.orm import Session
from app.database import engine, SessionLocal, Base
from app.models import Word, UserProgress
from app.config import settings

def init_db():
    """Create all database tables based on SQLAlchemy metadata."""
    Base.metadata.create_all(bind=engine)

def seed_vocab(db: Session, seed_file: Path = None) -> int:
    """
    Seed initial JLPT N5 & N4 vocabulary from JSON file.
    Creates both the Word record and initializes UserProgress with 1 Star.
    """
    if seed_file is None:
        seed_file = settings.SEED_FILE

    if not seed_file.exists():
        raise FileNotFoundError(f"Seed file not found: {seed_file}")

    with open(seed_file, "r", encoding="utf-8") as f:
        vocab_list = json.load(f)

    inserted_count = 0
    for item in vocab_list:
        # Check if word already exists by kana and meaning
        existing = db.query(Word).filter(
            Word.kana == item["kana"],
            Word.meaning == item["meaning"]
        ).first()

        if not existing:
            word = Word(
                kanji=item.get("kanji"),
                kana=item["kana"],
                romaji=item["romaji"],
                meaning=item["meaning"],
                jlpt_level=item["jlpt_level"],
                part_of_speech=item["part_of_speech"],
                example_ja=item.get("example_ja"),
                example_en=item.get("example_en"),
            )
            db.add(word)
            db.flush()  # Obtain word.id

            # Initialize 1-star progress for spaced recall
            progress = UserProgress(
                word_id=word.id,
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
    print("Initializing database tables...")
    init_db()
    db = SessionLocal()
    try:
        count = seed_vocab(db)
        print(f"Successfully seeded {count} words and initialized user progress!")
    finally:
        db.close()
