from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models import Word, UserProgress
from app.schemas import WordOut

router = APIRouter(prefix="/words", tags=["Words"])

@router.get("", response_model=List[WordOut])
def list_words(
    level: Optional[str] = Query(None, description="Filter by JLPT level: 'N5' or 'N4'"),
    stars: Optional[int] = Query(None, ge=1, le=5, description="Filter by star rating (1-5)"),
    search: Optional[str] = Query(None, description="Search term for kanji, kana, romaji, or meaning"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Returns a paginated list of vocabulary words with their progress status."""
    query = db.query(Word).join(UserProgress, Word.id == UserProgress.word_id)

    if level:
        query = query.filter(Word.jlpt_level == level)

    if stars:
        query = query.filter(UserProgress.star_rating == stars)

    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Word.kanji.ilike(pattern),
                Word.kana.ilike(pattern),
                Word.romaji.ilike(pattern),
                Word.meaning.ilike(pattern)
            )
        )

    words = query.order_by(Word.id).offset(offset).limit(limit).all()
    return words

@router.get("/{word_id}", response_model=WordOut)
def get_word(word_id: int, db: Session = Depends(get_db)):
    """Fetches full details for a single vocabulary word."""
    word = db.query(Word).filter(Word.id == word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found.")
    return word
