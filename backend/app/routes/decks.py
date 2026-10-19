from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.database import get_db
from app.models import Deck, Word, UserProgress, User
from app.auth import get_current_user_optional, get_current_user_required
from app.schemas import DeckOut, WordOut, ProgressOut, DeckStats, MessageResponse

def is_card_due(next_review_due, now: datetime) -> bool:
    if next_review_due is None:
        return True
    if next_review_due.tzinfo is None:
        next_review_due = next_review_due.replace(tzinfo=timezone.utc)
    return next_review_due <= now

router = APIRouter(prefix="/decks", tags=["Decks"])

@router.get("", response_model=List[DeckOut])
def list_decks(
    level: Optional[str] = Query(None, description="Filter by 'N5' or 'N4'"),
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Returns all themed decks ordered by sort_order,
    enriched with user-specific metrics: total words, words in review,
    mastered words, mastery percentage, and due review count.
    """
    now = datetime.now(timezone.utc)
    deck_query = db.query(Deck)
    if level:
        deck_query = deck_query.filter(Deck.jlpt_level == level.upper())
    decks = deck_query.order_by(Deck.sort_order.asc(), Deck.id.asc()).all()

    results = []
    for d in decks:
        # Total words in deck
        total_words = db.query(func.count(Word.id)).filter(Word.deck_id == d.id).scalar() or 0

        # User progress metrics for this deck
        user_progs = db.query(UserProgress).join(
            Word, Word.id == UserProgress.word_id
        ).filter(
            Word.deck_id == d.id,
            UserProgress.user_id == user.id
        ).all()

        words_in_review = sum(1 for p in user_progs if p.is_in_review)
        mastered_words = sum(1 for p in user_progs if p.star_rating == 5)
        
        # Count due cards
        due_count = sum(
            1 for p in user_progs 
            if p.is_in_review and is_card_due(p.next_review_due, now)
        )

        total_stars = sum(p.star_rating for p in user_progs)
        mastery_pct = 0.0
        if total_words > 0:
            mastery_pct = round((total_stars / (total_words * 5.0)) * 100, 1)

        deck_dict = {
            "id": d.id,
            "slug": d.slug,
            "name": d.name,
            "name_ja": d.name_ja,
            "description": d.description,
            "icon": d.icon,
            "color": d.color,
            "jlpt_level": d.jlpt_level,
            "sort_order": d.sort_order,
            "total_words": total_words,
            "words_in_review": words_in_review,
            "mastered_words": mastered_words,
            "mastery_percentage": mastery_pct,
            "due_count": due_count
        }
        results.append(DeckOut(**deck_dict))

    return results


@router.get("/{deck_id}")
def get_deck_detail(
    deck_id: int,
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Returns deck metadata and all vocabulary words with the current user's progress.
    """
    deck = db.query(Deck).filter(Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found.")

    words = db.query(Word).filter(Word.deck_id == deck_id).all()
    word_ids = [w.id for w in words]

    # Batch fetch user progress
    progs = db.query(UserProgress).filter(
        UserProgress.user_id == user.id,
        UserProgress.word_id.in_(word_ids)
    ).all()
    prog_map = {p.word_id: p for p in progs}

    now = datetime.now(timezone.utc)
    words_data = []
    for w in words:
        p = prog_map.get(w.id)
        prog_data = None
        if p:
            prog_data = ProgressOut.model_validate(p)
        words_data.append({
            "id": w.id,
            "deck_id": w.deck_id,
            "lesson_number": w.lesson_number,
            "book_title": w.book_title,
            "kanji": w.kanji,
            "kana": w.kana,
            "romaji": w.romaji,
            "meaning": w.meaning,
            "jlpt_level": w.jlpt_level,
            "part_of_speech": w.part_of_speech,
            "example_ja": w.example_ja,
            "example_en": w.example_en,
            "mnemonic": w.mnemonic,
            "progress": prog_data
        })

    words_in_review = sum(1 for p in progs if p.is_in_review)
    mastered = sum(1 for p in progs if p.star_rating == 5)
    due_count = sum(1 for p in progs if p.is_in_review and is_card_due(p.next_review_due, now))
    total_stars = sum(p.star_rating for p in progs)
    mastery_pct = round((total_stars / (len(words) * 5.0)) * 100, 1) if words else 0.0

    return {
        "id": deck.id,
        "slug": deck.slug,
        "name": deck.name,
        "name_ja": deck.name_ja,
        "description": deck.description,
        "icon": deck.icon,
        "color": deck.color,
        "jlpt_level": deck.jlpt_level,
        "sort_order": deck.sort_order,
        "total_words": len(words),
        "words_in_review": words_in_review,
        "mastered_words": mastered,
        "due_count": due_count,
        "mastery_percentage": mastery_pct,
        "words": words_data
    }


@router.post("/{deck_id}/add-to-queue", response_model=MessageResponse)
def add_deck_to_review_queue(
    deck_id: int,
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Adds all words in this themed deck to the user's review queue.
    """
    deck = db.query(Deck).filter(Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found.")

    words = db.query(Word).filter(Word.deck_id == deck_id).all()
    count = 0
    now = datetime.now(timezone.utc)

    for w in words:
        prog = db.query(UserProgress).filter_by(user_id=user.id, word_id=w.id).first()
        if not prog:
            prog = UserProgress(
                user_id=user.id,
                word_id=w.id,
                is_in_review=True,
                star_rating=1,
                repetitions=0,
                interval_days=0.0,
                ease_factor=2.5,
                next_review_due=now
            )
            db.add(prog)
            count += 1
        else:
            if not prog.is_in_review:
                prog.is_in_review = True
                if prog.next_review_due is None:
                    prog.next_review_due = now
                count += 1

    db.commit()
    return MessageResponse(
        message=f"Added {count} new words from '{deck.name}' to your review queue!",
        success=True
    )


# Backward compatible summary endpoint
@router.get("/summary", response_model=DeckStats)
def get_deck_summary(
    level: Optional[str] = Query(None, description="Optional filter by 'N5' or 'N4'"),
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    query = db.query(Word, UserProgress).join(
        UserProgress,
        (Word.id == UserProgress.word_id) & (UserProgress.user_id == user.id)
    )
    if level:
        query = query.filter(Word.jlpt_level == level.upper())

    all_pairs = query.all()
    total_words = len(all_pairs)
    star_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    mastered = familiar = learning = unfamiliar = 0
    total_attempts = correct_attempts = words_in_review = 0

    for word, prog in all_pairs:
        s = prog.star_rating
        star_distribution[s] = star_distribution.get(s, 0) + 1
        if s == 5:
            mastered += 1
        elif s in (3, 4):
            familiar += 1
        elif s == 2:
            learning += 1
        else:
            unfamiliar += 1

        if prog.is_in_review:
            words_in_review += 1

        total_attempts += prog.total_attempts
        correct_attempts += prog.correct_attempts

    overall_accuracy = round((correct_attempts / total_attempts) * 100, 1) if total_attempts > 0 else 0.0

    level_counts = {}
    level_query = db.query(Word.jlpt_level, func.count(Word.id)).group_by(Word.jlpt_level).all()
    for lvl, count in level_query:
        level_counts[lvl] = count

    return DeckStats(
        total_words=total_words,
        words_in_review=words_in_review,
        mastered_count=mastered,
        familiar_count=familiar,
        learning_count=learning,
        unfamiliar_count=unfamiliar,
        overall_accuracy=overall_accuracy,
        total_reviews_done=total_attempts,
        star_distribution=star_distribution,
        level_counts=level_counts,
        chapter_mastery={}
    )


@router.post("/reset")
def reset_progress(
    level: Optional[str] = Query(None),
    user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    query = db.query(UserProgress).join(Word, Word.id == UserProgress.word_id).filter(
        UserProgress.user_id == user.id
    )
    if level:
        query = query.filter(Word.jlpt_level == level.upper())

    records = query.all()
    now = datetime.now(timezone.utc)
    for p in records:
        p.is_in_review = False
        p.star_rating = 1
        p.repetitions = 0
        p.interval_days = 0.0
        p.ease_factor = 2.5
        p.streak = 0
        p.correct_streak = 0
        p.total_attempts = 0
        p.correct_attempts = 0
        p.next_review_due = None
        p.last_reviewed_at = None

    db.commit()
    return {"message": f"Reset progress for {len(records)} words.", "success": True}
