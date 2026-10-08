import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .. import models as M
from ..config import MAX_UPLOAD_BYTES, UPLOAD_DIR
from ..database import get_db
from ..schemas import ContactAdd, ProfileUpdate
from ..security import USERNAME_RE, current_user, find_user_by_identifier
from ..services import broadcast_presence, user_out

router = APIRouter(prefix="/api", tags=["users"])
# Active-content types must never be served back as web pages from the API origin.
UNSAFE_EXTENSIONS = {".html", ".htm", ".xhtml", ".svg", ".xml", ".js", ".mjs", ".php"}


@router.get("/me")
def me(user: M.User = Depends(current_user)):
    return user_out(user)


@router.patch("/me")
async def update_me(body: ProfileUpdate, user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    data = body.model_dump(exclude_unset=True)
    if "username" in data:
        uname = (data["username"] or "").strip().lower().lstrip("@") or None
        if uname and not USERNAME_RE.match(uname):
            raise HTTPException(400, "Username must be 3-24 characters: a-z, 0-9, _ or .")
        if uname and db.scalar(select(M.User).where(M.User.username == uname, M.User.id != user.id)):
            raise HTTPException(409, "That username is taken")
        if not uname and not user.phone:
            raise HTTPException(400, "You need either a phone number or a username")
        user.username = uname
        data.pop("username")
    for k, v in data.items():
        if k == "display_name":
            v = v.strip()
        setattr(user, k, v)
    db.commit()
    return user_out(user)


@router.get("/users/search")
def search_users(q: str = "", user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    q = q.strip().lstrip("@")
    if len(q) < 2:
        return []
    like = f"%{q}%"
    digits = "".join(c for c in q if c.isdigit())
    conds = [M.User.display_name.ilike(like), M.User.username.ilike(like)]
    if len(digits) >= 3:
        conds.append(M.User.phone.like(f"%{digits}%"))
    rows = db.scalars(select(M.User).where(M.User.id != user.id, or_(*conds)).order_by(M.User.display_name).limit(20)).all()
    return [user_out(u) for u in rows]


@router.get("/contacts")
def list_contacts(user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(M.User).join(M.Contact, M.Contact.contact_id == M.User.id)
        .where(M.Contact.owner_id == user.id).order_by(M.User.display_name)).all()
    return [user_out(u) for u in rows]


@router.post("/contacts")
def add_contact(body: ContactAdd, user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    target = db.get(M.User, body.user_id) if body.user_id else (find_user_by_identifier(db, body.identifier) if body.identifier else None)
    if not target:
        raise HTTPException(404, "No Signal user found with those details")
    if target.id == user.id:
        raise HTTPException(400, "You can't add yourself")
    if not db.scalar(select(M.Contact).where(M.Contact.owner_id == user.id, M.Contact.contact_id == target.id)):
        db.add(M.Contact(owner_id=user.id, contact_id=target.id))
        db.commit()
    return user_out(target)


@router.delete("/contacts/{contact_id}")
def remove_contact(contact_id: int, user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    c = db.scalar(select(M.Contact).where(M.Contact.owner_id == user.id, M.Contact.contact_id == contact_id))
    if c:
        db.delete(c)
        db.commit()
    return {"ok": True}


@router.get("/users/{user_id}")
def get_user(user_id: int, user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    u = db.get(M.User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    return user_out(u)


@router.post("/uploads")
async def upload(file: UploadFile = File(...), user: M.User = Depends(current_user)):
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large (max 10 MB)")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "").suffix[:10].lower()
    if ext in UNSAFE_EXTENSIONS:
        ext = ".bin"
    name = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / name).write_bytes(data)
    return {"url": f"/uploads/{name}", "name": file.filename or name, "type": file.content_type or "application/octet-stream", "size": len(data)}
