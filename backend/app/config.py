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

settings = Settings()
