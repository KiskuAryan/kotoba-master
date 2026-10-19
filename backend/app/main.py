from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.config import settings
from app.database import engine, SessionLocal, Base
from app.seed import init_db, seed_vocab, seed_chapters
from app.routes import quiz, decks, words, ai, chapters

FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist, chapters seeded, and initial vocabulary seeded
    init_db()
    db = SessionLocal()
    try:
        seed_chapters(db)
        seed_vocab(db)
    finally:
        db.close()
    yield
    # Shutdown logic if needed

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="5-Star Spaced Recall Mastery Web App for JLPT N5 & N4 Vocabulary",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(quiz.router, prefix="/api")
app.include_router(chapters.router, prefix="/api")
app.include_router(decks.router, prefix="/api")
app.include_router(words.router, prefix="/api")
app.include_router(ai.router, prefix="/api")

# Mount Static Files (CSS, JS, Assets)
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/", include_in_schema=False)
def serve_frontend_index():
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "KotobaMaster API is running. Build frontend/index.html to view the web UI."}

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "app": settings.PROJECT_NAME, "version": settings.PROJECT_VERSION}
