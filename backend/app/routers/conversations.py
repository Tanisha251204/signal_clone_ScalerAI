import random

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as M
from ..database import get_db
from ..schemas import (
    ConversationUpdate, DirectCreate, GroupCreate, MembersAdd, MessageCreate, ReactionBody, RoleUpdate,
)
from ..security import current_user
from ..services import (
    conversation_out, create_message, get_or_create_direct, get_member, iso, mark_read, member_ids, push_conversation,
    require_admin, require_member, serialize_message, serialize_messages, system_message, utcnow, visible_filter,
)
from ..ws_manager import manager

router = APIRouter(prefix="/api", tags=["conversations"])
GROUP_COLORS = ["#2C6BED", "#E0457B", "#1B998B", "#8E44AD", "#F29D38", "#D64545", "#3D5A80", "#5B8C5A"]
TIMER_LABELS = {30: "30 seconds", 300: "5 minutes", 3600: "1 hour", 28800: "8 hours", 86400: "1 day", 604800: "1 week"}


def _ensure_contact(db: Session, owner: int, other: int) -> None:
    if owner != other and not db.scalar(select(M.Contact).where(M.Contact.owner_id == owner, M.Contact.contact_id == other)):
        db.add(M.Contact(owner_id=owner, contact_id=other))


@router.get("/conversations")
def list_conversations(user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    convs = db.scalars(
        select(M.Conversation).join(M.ConversationMember, M.ConversationMember.conversation_id == M.Conversation.id)
        .where(M.ConversationMember.user_id == user.id).order_by(M.Conversation.updated_at.desc())).all()
    out = []
    for c in convs:
        d = conversation_out(db, c, user.id)
        # hide never-used DMs that someone else opened (no leak of "X looked at you")
        if c.type == "direct" and not d["last_message"] and c.created_by != user.id:
            continue
        out.append(d)
    return out


@router.post("/conversations/direct")
async def create_direct(body: DirectCreate, user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    other = db.get(M.User, body.user_id)
    if not other or other.id == user.id:
        raise HTTPException(400, "Choose another user")
    conv, _ = get_or_create_direct(db, user.id, other.id)
    _ensure_contact(db, user.id, other.id)
    db.commit()
    return conversation_out(db, conv, user.id)


@router.post("/conversations/group")
async def create_group(body: GroupCreate, user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    ids = [i for i in dict.fromkeys(body.member_ids) if i != user.id]
    users = db.scalars(select(M.User).where(M.User.id.in_(ids))).all()
    if not users or len(users) != len(ids):
        raise HTTPException(400, "Select at least one valid member")
    t = utcnow()
    conv = M.Conversation(type="group", name=body.name.strip(), avatar_color=random.choice(GROUP_COLORS),
                          created_by=user.id, created_at=t, updated_at=t)
    db.add(conv)
    db.flush()
    db.add(M.ConversationMember(conversation_id=conv.id, user_id=user.id, role="admin", joined_at=t))
    for u in users:
        db.add(M.ConversationMember(conversation_id=conv.id, user_id=u.id, role="member", joined_at=t))
    db.commit()
    await system_message(db, conv, f"{user.display_name} created the group", user.id)
    await push_conversation(db, conv)
    return conversation_out(db, conv, user.id)


@router.get("/conversations/{cid}")
def get_conversation(cid: int, user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    conv, _ = require_member(db, cid, user.id)
    return conversation_out(db, conv, user.id)


@router.patch("/conversations/{cid}")
async def update_conversation(cid: int, body: ConversationUpdate, user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    conv, mem = require_member(db, cid, user.id)
    changed_msgs: list[str] = []
    if body.name is not None and body.name.strip() != conv.name:
        if conv.type != "group":
            raise HTTPException(400, "Only groups can be renamed")
        require_admin(db, cid, user.id)
        conv.name = body.name.strip()
        changed_msgs.append(f'{user.display_name} renamed the group to "{conv.name}"')
    if body.clear_disappear or body.disappear_after is not None:
        if conv.type == "group" and mem.role != "admin":
            raise HTTPException(403, "Only group admins can change disappearing messages")
        secs = None if body.clear_disappear else body.disappear_after
        if secs is not None and secs not in TIMER_LABELS:
            raise HTTPException(400, "Unsupported timer")
        if secs != conv.disappear_after:
            conv.disappear_after = secs
            changed_msgs.append(f"{user.display_name} set disappearing messages to {TIMER_LABELS[secs]}" if secs
                                else f"{user.display_name} turned off disappearing messages")
    db.commit()
    for text in changed_msgs:
        await system_message(db, conv, text, user.id)
    await push_conversation(db, conv)
    return conversation_out(db, conv, user.id)


@router.post("/conversations/{cid}/members")
async def add_members(cid: int, body: MembersAdd, user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    conv = require_admin(db, cid, user.id)
    existing = set(member_ids(db, cid))
    users = db.scalars(select(M.User).where(M.User.id.in_(body.user_ids))).all()
    new = [u for u in users if u.id not in existing]
    if not new:
        raise HTTPException(400, "Those people are already in the group")
    t = utcnow()
    for u in new:
        db.add(M.ConversationMember(conversation_id=cid, user_id=u.id, role="member", joined_at=t))
    db.commit()
    await system_message(db, conv, f"{user.display_name} added {', '.join(u.display_name for u in new)}", user.id)
    await push_conversation(db, conv)
    return conversation_out(db, conv, user.id)


@router.patch("/conversations/{cid}/members/{uid}")
async def set_role(cid: int, uid: int, body: RoleUpdate, user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    conv = require_admin(db, cid, user.id)
    if body.role not in ("admin", "member"):
        raise HTTPException(400, "Invalid role")
    target = get_member(db, cid, uid)
    if not target:
        raise HTTPException(404, "Member not found")
    if target.role == "admin" and body.role == "member":
        admins = [m for m in db.scalars(select(M.ConversationMember).where(
            M.ConversationMember.conversation_id == cid, M.ConversationMember.role == "admin"))]
        if len(admins) <= 1:
            raise HTTPException(400, "A group needs at least one admin")
    target.role = body.role
    db.commit()
    tu = db.get(M.User, uid)
    await system_message(db, conv, f"{user.display_name} {'made' if body.role == 'admin' else 'removed'} {tu.display_name} "
                                   f"{'an admin' if body.role == 'admin' else 'as admin'}", user.id)
    await push_conversation(db, conv)
    return conversation_out(db, conv, user.id)


@router.delete("/conversations/{cid}/members/{uid}")
async def remove_member(cid: int, uid: int, user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    conv, mem = require_member(db, cid, user.id)
    if conv.type != "group":
        raise HTTPException(400, "Not a group")
    leaving = uid == user.id
    if not leaving:
        require_admin(db, cid, user.id)
    target = get_member(db, cid, uid)
    if not target:
        raise HTTPException(404, "Member not found")
    tu = db.get(M.User, uid)
    db.delete(target)
    db.commit()
    remaining = db.scalars(select(M.ConversationMember).where(M.ConversationMember.conversation_id == cid).order_by(M.ConversationMember.id)).all()
    if not remaining:
        db.delete(conv)
        db.commit()
        await manager.send_user(uid, {"type": "conversation.removed", "conversation_id": cid})
        return {"ok": True}
    if not any(m.role == "admin" for m in remaining):  # never leave a group without an admin
        remaining[0].role = "admin"
        db.commit()
    await manager.send_user(uid, {"type": "conversation.removed", "conversation_id": cid})
    text = f"{tu.display_name} left the group" if leaving else f"{user.display_name} removed {tu.display_name}"
    await system_message(db, conv, text, user.id)
    await push_conversation(db, conv)
    return {"ok": True}


@router.get("/conversations/{cid}/messages")
def get_messages(cid: int, before_id: int | None = None, limit: int = 50, user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    conv, mem = require_member(db, cid, user.id)
    limit = max(1, min(limit, 100))
    q = select(M.Message).where(visible_filter(cid, mem.joined_at))
    if before_id:
        q = q.where(M.Message.id < before_id)
    rows = db.scalars(q.order_by(M.Message.id.desc()).limit(limit + 1)).all()
    has_more = len(rows) > limit
    rows = list(reversed(rows[:limit]))
    return {"messages": serialize_messages(db, rows), "has_more": has_more}


@router.post("/conversations/{cid}/messages")
async def send_message(cid: int, body: MessageCreate, user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    conv, mem = require_member(db, cid, user.id)
    text = body.body.strip()
    if not text and not body.attachment_url:
        raise HTTPException(400, "Message is empty")
    if body.reply_to_id:
        target = db.get(M.Message, body.reply_to_id)
        if not target or target.conversation_id != cid:
            raise HTTPException(400, "Invalid reply target")
    if body.client_id:  # idempotent retry
        dup = db.scalar(select(M.Message).where(M.Message.conversation_id == cid, M.Message.sender_id == user.id, M.Message.client_id == body.client_id))
        if dup:
            return serialize_message(db, dup)
    attachment = None
    if body.attachment_url:
        if not body.attachment_url.startswith("/uploads/"):
            raise HTTPException(400, "Invalid attachment")
        attachment = {"url": body.attachment_url, "name": body.attachment_name, "type": body.attachment_type, "size": body.attachment_size}
    data = await create_message(db, conv, user.id, text, client_id=body.client_id, reply_to_id=body.reply_to_id, attachment=attachment)
    await push_conversation(db, conv)
    return data


@router.post("/conversations/{cid}/read")
async def read_conversation(cid: int, user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    require_member(db, cid, user.id)
    return {"updated": await mark_read(db, cid, user.id)}


@router.post("/messages/{mid}/reactions")
async def toggle_reaction(mid: int, body: ReactionBody, user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    m = db.get(M.Message, mid)
    if not m or m.kind != "text" or m.is_deleted:
        raise HTTPException(404, "Message not found")
    require_member(db, m.conversation_id, user.id)
    existing = db.scalar(select(M.Reaction).where(M.Reaction.message_id == mid, M.Reaction.user_id == user.id))
    if existing and existing.emoji == body.emoji:
        db.delete(existing)
    elif existing:
        existing.emoji = body.emoji
    else:
        db.add(M.Reaction(message_id=mid, user_id=user.id, emoji=body.emoji))
    db.commit()
    data = serialize_message(db, m)
    await manager.send_users(member_ids(db, m.conversation_id), {"type": "message.updated", "message": data})
    return data


@router.delete("/messages/{mid}")
async def delete_message(mid: int, user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    m = db.get(M.Message, mid)
    if not m or m.kind != "text":
        raise HTTPException(404, "Message not found")
    require_member(db, m.conversation_id, user.id)
    if m.sender_id != user.id:
        raise HTTPException(403, "You can only delete your own messages")
    m.is_deleted = True
    m.body = ""
    db.query(M.Reaction).filter(M.Reaction.message_id == mid).delete()
    db.commit()
    data = serialize_message(db, m)
    conv = db.get(M.Conversation, m.conversation_id)
    await manager.send_users(member_ids(db, conv.id), {"type": "message.updated", "message": data})
    await push_conversation(db, conv)
    return data
