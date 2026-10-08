import re
import secrets
from datetime import timedelta

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models as M
from .config import SESSION_DAYS
from .database import get_db

PHONE_RE = re.compile(r"^\+?[\d\s\-()]{7,20}$")
USERNAME_RE = re.compile(r"^[a-z0-9_.]{3,24}$")


def parse_identifier(raw: str) -> tuple[str, str]:
    """Return ('phone', '+9198...') or ('username', 'name'). Raises 400 on junk."""
    raw = (raw or "").strip()
    if PHONE_RE.match(raw):
        digits = re.sub(r"\D", "", raw)
        if not 7 <= len(digits) <= 15:
            raise HTTPException(400, "Enter a valid phone number")
        return "phone", "+" + digits
    uname = raw.lower().lstrip("@")
    if USERNAME_RE.match(uname):
        return "username", uname
    raise HTTPException(400, "Enter a phone number (with country code) or a username (3-24 letters, digits, _ .)")


def create_session(db: Session, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    db.add(M.UserSession(token=token, user_id=user_id, expires_at=M.utcnow() + timedelta(days=SESSION_DAYS)))
    db.commit()
    return token


def user_from_token(db: Session, token: str | None) -> M.User | None:
    if not token:
        return None
    s = db.get(M.UserSession, token)
    if not s or s.expires_at < M.utcnow():
        return None
    return db.get(M.User, s.user_id)


def current_user(authorization: str | None = Header(None), db: Session = Depends(get_db)) -> M.User:
    token = authorization.split(" ", 1)[1].strip() if authorization and authorization.lower().startswith("bearer ") else None
    user = user_from_token(db, token)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


def find_user_by_identifier(db: Session, raw: str) -> M.User | None:
    kind, value = parse_identifier(raw)
    col = M.User.phone if kind == "phone" else M.User.username
    return db.scalar(select(M.User).where(col == value))
