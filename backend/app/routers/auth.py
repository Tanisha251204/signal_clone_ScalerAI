from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as M
from ..config import FIXED_OTP
from ..database import get_db
from ..schemas import LoginBody, OtpRequest, RegisterBody
from ..security import create_session, current_user, find_user_by_identifier, parse_identifier
from ..services import user_out

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/request-otp")
def request_otp(body: OtpRequest, db: Session = Depends(get_db)):
    """Mocked verification: no SMS is sent, the OTP is a fixed code."""
    kind, value = parse_identifier(body.identifier)
    exists = find_user_by_identifier(db, body.identifier) is not None
    return {"identifier": value, "kind": kind, "exists": exists, "otp_hint": FIXED_OTP}


@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    if body.otp != FIXED_OTP:
        raise HTTPException(400, "Incorrect verification code")
    user = find_user_by_identifier(db, body.identifier)
    if not user:
        raise HTTPException(404, "No account found. Please register first.")
    return {"token": create_session(db, user.id), "user": user_out(user)}


@router.post("/register")
def register(body: RegisterBody, db: Session = Depends(get_db)):
    if body.otp != FIXED_OTP:
        raise HTTPException(400, "Incorrect verification code")
    kind, value = parse_identifier(body.identifier)
    if find_user_by_identifier(db, body.identifier):
        raise HTTPException(409, "An account with this phone number or username already exists")
    user = M.User(
        display_name=body.display_name.strip(), avatar_color=body.avatar_color or "#2C6BED", avatar_url=body.avatar_url,
        **{kind: value},
    )
    db.add(user)
    db.commit()
    return {"token": create_session(db, user.id), "user": user_out(user)}


@router.post("/logout")
def logout(authorization: str | None = Header(None), user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    token = authorization.split(" ", 1)[1].strip()
    sess = db.get(M.UserSession, token)
    if sess:
        db.delete(sess)
        db.commit()
    return {"ok": True}


@router.get("/demo-users")
def demo_users(db: Session = Depends(get_db)):
    """Seeded accounts shown on the login screen so reviewers can test quickly."""
    users = db.scalars(select(M.User).where(M.User.phone.like("+91981000000%")).order_by(M.User.id).limit(8)).all()
    return [{"display_name": u.display_name, "phone": u.phone, "avatar_color": u.avatar_color} for u in users]
