import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(__file__).resolve().parent / "data"

class Settings:
    PROJECT_NAME: str = "KotobaMaster"
    PROJECT_VERSION: str = "1.0.0"
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/kotoba.db")
    SEED_FILE: Path = DATA_DIR / "minna_vocab.json"
    CORS_ORIGINS: list = ["*"]
    JWT_SECRET: str = os.getenv("JWT_SECRET", "kotoba-master-super-secret-jwt-key-change-in-production-32chars")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 30

    # Email / SMTP Settings
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_TLS: bool = os.getenv("SMTP_TLS", "true").lower() in ("true", "1", "yes")
    EMAILS_FROM: str = os.getenv("EMAILS_FROM", "KotobaMaster <no-reply@kotobamaster.com>")
    APP_URL: str = os.getenv("APP_URL", "http://localhost:8000")

settings = Settings()
