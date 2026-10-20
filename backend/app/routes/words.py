from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models import Word, UserProgress, User, Deck
from app.auth import get_current_user_optional
from app.schemas import WordOut, WordDetailOut, ProgressOut, ToggleReviewResponse

router = APIRouter(prefix="/words", tags=["Words"])

@router.get("", response_model=List[WordOut])
def list_words(
    deck_id: Optional[int] = Query(None, description="Filter by deck ID"),
    level: Optional[str] = Query(None, description="Filter by JLPT level: 'N5' or 'N4'"),
    lesson: Optional[int] = Query(None, description="Filter by Minna no Nihongo Lesson (1-25)"),
    in_review: Optional[bool] = Query(None, description="Filter by review queue status"),
    stars: Optional[int] = Query(None, ge=1, le=5, description="Filter by star rating (1-5)"),
    search: Optional[str] = Query(None, description="Search term for kanji, kana, romaji, or meaning"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Returns a paginated list of vocabulary words with the current user's progress status."""
    query = db.query(Word)

    if deck_id is not None:
        query = query.filter(Word.deck_id == deck_id)

    if level:
        query = query.filter(Word.jlpt_level == level.upper())

    if lesson:
        query = query.filter(Word.lesson_number == lesson)

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
    word_ids = [w.id for w in words]

    # Batch fetch user progress
    progs = db.query(UserProgress).filter(
        UserProgress.user_id == user.id,
        UserProgress.word_id.in_(word_ids)
    ).all()
    prog_map = {p.word_id: p for p in progs}

    results = []
    for w in words:
        p = prog_map.get(w.id)
        if in_review is not None:
            is_rev = p.is_in_review if p else False
            if is_rev != in_review:
                continue
        if stars is not None:
            st = p.star_rating if p else 1
            if st != stars:
                continue

        prog_out = ProgressOut.model_validate(p) if p else None
        word_dict = {
            "id": w.id,
            "deck_id": w.deck_id,
            "lesson_number": w.lesson_number,
            "book_title": w.book_title,
            "kanji": w.kanji,
            "kana": w.kana,
            "romaji": w.romaji,
            "meaning": w.meaning,
            "jlpt_level": w.jlpt_level,
            "level": w.jlpt_level,
            "part_of_speech": w.part_of_speech,
            "example_ja": w.example_ja,
            "example_en": w.example_en,
            "example_sentence": w.example_ja,
            "example_translation": w.example_en,
            "mnemonic": w.mnemonic,
            "stars": p.star_rating if p else 1,
            "is_in_review": p.is_in_review if p else False,
            "user_notes": p.user_notes if p else "",
            "progress": prog_out
        }
        results.append(WordOut(**word_dict))

    return results


@router.get("/{word_id}", response_model=WordDetailOut)
def get_word_detail(
    word_id: int,
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Fetches full details for a single vocabulary word including deck name and personal user notes."""
    word = db.query(Word).filter(Word.id == word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found.")

    prog = db.query(UserProgress).filter_by(user_id=user.id, word_id=word_id).first()
    prog_out = ProgressOut.model_validate(prog) if prog else None

    deck_name = word.deck.name if word.deck else None

    return WordDetailOut(
        id=word.id,
        deck_id=word.deck_id,
        deck_name=deck_name,
        lesson_number=word.lesson_number,
        book_title=word.book_title,
        kanji=word.kanji,
        kana=word.kana,
        romaji=word.romaji,
        meaning=word.meaning,
        jlpt_level=word.jlpt_level,
        level=word.jlpt_level,
        part_of_speech=word.part_of_speech,
        example_ja=word.example_ja,
        example_en=word.example_en,
        example_sentence=word.example_ja,
        example_translation=word.example_en,
        mnemonic=word.mnemonic,
        stars=prog.star_rating if prog else 1,
        is_in_review=prog.is_in_review if prog else False,
        user_notes=prog.user_notes if prog else "",
        progress=prog_out
    )


@router.put("/{word_id}/notes")
def update_word_notes(
    word_id: int,
    payload: dict = Body(...),
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Updates the user's personal notes/mnemonic for this word."""
    word = db.query(Word).filter(Word.id == word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found.")

    notes = payload.get("notes", "").strip()

    prog = db.query(UserProgress).filter_by(user_id=user.id, word_id=word_id).first()
    if not prog:
        prog = UserProgress(
            user_id=user.id,
            word_id=word_id,
            user_notes=notes
        )
        db.add(prog)
    else:
        prog.user_notes = notes

    db.commit()
    return {"message": "Notes saved successfully.", "notes": notes, "success": True}


@router.post("/{word_id}/toggle-review", response_model=ToggleReviewResponse)
def toggle_word_review(
    word_id: int,
    payload: dict = Body(None),
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Toggles a word in or out of the user's review queue."""
    word = db.query(Word).filter(Word.id == word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found.")

    is_in_review = payload.get("is_in_review", True) if payload else True

    prog = db.query(UserProgress).filter_by(user_id=user.id, word_id=word_id).first()
    now = datetime.now(timezone.utc)

    if not prog:
        prog = UserProgress(
            user_id=user.id,
            word_id=word_id,
            is_in_review=is_in_review,
            star_rating=1,
            next_review_due=now if is_in_review else None
        )
        db.add(prog)
    else:
        prog.is_in_review = is_in_review
        if is_in_review and prog.next_review_due is None:
            prog.next_review_due = now

    db.commit()
    msg = f"Added '{word.kana}' to review queue." if is_in_review else f"Removed '{word.kana}' from review queue."
    return ToggleReviewResponse(word_id=word_id, is_in_review=is_in_review, message=msg)
