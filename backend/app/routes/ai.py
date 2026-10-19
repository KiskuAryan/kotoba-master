import os
import json
import urllib.request
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/ai", tags=["AI Integration"])

class SentencePromptRequest(BaseModel):
    word: str
    kana: Optional[str] = None
    meaning: Optional[str] = None
    level: str = "N5"

class SentenceExplanationResponse(BaseModel):
    japanese_sentence: str
    romaji: str
    english_translation: str
    grammar_breakdown: str
    mnemonic: str
    source: str  # "gemini-api" or "curated-engine"

# Curated fallback knowledge base for instant zero-config responses
OFFLINE_SENTENCE_CACHE = {
    "食べる": {
        "sentence": "昼休みに同僚とお弁当を食べます。",
        "romaji": "Hiruyasumi ni douryou to obentou wo tabemasu.",
        "translation": "I eat lunch with colleagues during the lunch break.",
        "grammar": "『を』marks the direct object (lunch box). 『と』indicates doing something together with someone.",
        "mnemonic": "Imagine sitting at a table (たべる / taberu) eating food."
    },
    "飲む": {
        "sentence": "朝礼の前に温かいお茶を飲みます。",
        "romaji": "Chourei no mae ni atatakai ocha wo nomimasu.",
        "translation": "I drink warm tea before the morning meeting.",
        "grammar": "『〜の前に』means 'before doing something'. 『飲みます』is the polite present form of 飲む.",
        "mnemonic": "No more (のむ) thirst after drinking tea!"
    },
    "働く": {
        "sentence": "来年から東京のIT企業で働きます。",
        "romaji": "Rainen kara Toukyou no IT kigyou de hatarakimasu.",
        "translation": "I will work at an IT company in Tokyo starting next year.",
        "grammar": "『で』marks the place where an action takes place. 『から』marks the starting time.",
        "mnemonic": "Work with hard (hatara) effort for cool (ku) rewards."
    },
    "説明する": {
        "sentence": "新しいシステムの設計をマネージャーに説明しました。",
        "romaji": "Atarashii shisutemu no sekkei wo manejaa ni setsumei shimashita.",
        "translation": "I explained the new system design to the manager.",
        "grammar": "『に』indicates the recipient of the explanation (the manager). 『しました』is polite past tense.",
        "mnemonic": "Setsumei sounds like setting the meaning clear."
    }
}

@router.post("/explain", response_model=SentenceExplanationResponse)
def generate_ai_explanation(payload: SentencePromptRequest):
    """
    Generates contextual Japanese sentence, grammar breakdown, and mnemonic.
    Uses Gemini API if GEMINI_API_KEY is configured in the environment,
    otherwise uses an intelligent zero-latency rule-based fallback.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")

    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            prompt = (
                f"You are a Japanese language tutor for JLPT {payload.level}. "
                f"For the vocabulary word '{payload.word}' ({payload.kana or ''}, meaning '{payload.meaning or ''}'), "
                f"provide a realistic beginner-friendly workplace or daily-life example sentence. "
                f"Return JSON strictly with keys: 'japanese_sentence', 'romaji', 'english_translation', 'grammar_breakdown', 'mnemonic'."
            )
            data = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json"}
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(data).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                res_body = json.loads(response.read().decode())
                text = res_body["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text)
                return SentenceExplanationResponse(
                    japanese_sentence=parsed.get("japanese_sentence", ""),
                    romaji=parsed.get("romaji", ""),
                    english_translation=parsed.get("english_translation", ""),
                    grammar_breakdown=parsed.get("grammar_breakdown", ""),
                    mnemonic=parsed.get("mnemonic", ""),
                    source="gemini-api"
                )
        except Exception:
            # Fall back safely if API call times out or errors
            pass

    # High-quality fallback engine
    cached = OFFLINE_SENTENCE_CACHE.get(payload.word)
    if cached:
        return SentenceExplanationResponse(
            japanese_sentence=cached["sentence"],
            romaji=cached["romaji"],
            english_translation=cached["translation"],
            grammar_breakdown=cached["grammar"],
            mnemonic=cached["mnemonic"],
            source="curated-engine"
        )

    # General template fallback
    kana = payload.kana or payload.word
    meaning = payload.meaning or "this concept"
    return SentenceExplanationResponse(
        japanese_sentence=f"毎日{payload.word}の練習をします。",
        romaji=f"Mainichi {kana} no renshuu wo shimasu.",
        english_translation=f"I practice {meaning} every day.",
        grammar_breakdown=f"『{payload.word}』is used here in a standard JLPT {payload.level} context with the direct object particle 『を』.",
        mnemonic=f"Focus on the reading '{kana}' when encountering '{payload.word}' in {payload.level} reading passages.",
        source="curated-engine"
    )
