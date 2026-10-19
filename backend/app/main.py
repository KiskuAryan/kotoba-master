from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.config import settings
from app.database import engine, SessionLocal, Base
from app.seed import init_db, seed_vocab, seed_chapters
from app.seed_themed import seed_database
from app.auth import ensure_demo_user
from app.routes import quiz, decks, words, ai, chapters, auth, reviews, stats, settings as settings_route

FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist, demo user, chapters seeded, and initial vocabulary seeded
    init_db()
    try:
        seed_database()
    except Exception as e:
        print(f"Warning during seed: {e}")
    db = SessionLocal()
    try:
        ensure_demo_user(db)
        seed_chapters(db, user_id=1)
        seed_vocab(db, user_id=1)
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
app.include_router(auth.router, prefix="/api")
app.include_router(decks.router, prefix="/api")
app.include_router(words.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(settings_route.router, prefix="/api")
app.include_router(quiz.router, prefix="/api")
app.include_router(chapters.router, prefix="/api")
app.include_router(ai.router, prefix="/api")

FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"
FRONTEND_DIST = FRONTEND_DIR / "dist"

# Mount Static Files / Assets
if FRONTEND_DIST.exists():
    if (FRONTEND_DIST / "assets").exists():
        app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")
if (FRONTEND_DIR / "legacy").exists():
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR / "legacy"), name="static")
elif FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/", include_in_schema=False)
def serve_frontend_index():
    if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
        return FileResponse(FRONTEND_DIST / "index.html")
    legacy_index = FRONTEND_DIR / "legacy" / "index.html"
    if legacy_index.exists():
        return FileResponse(legacy_index)
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "KotobaMaster API is running. Build frontend with 'npm run build' to view the web UI."}

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "app": settings.PROJECT_NAME, "version": settings.PROJECT_VERSION}
