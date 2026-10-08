import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'signal.db'}")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads")))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
FIXED_OTP = os.getenv("FIXED_OTP", "123456")
SEED_DEMO_DATA = os.getenv("SEED_DEMO_DATA", "1") == "1"
SESSION_DAYS = 30
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
