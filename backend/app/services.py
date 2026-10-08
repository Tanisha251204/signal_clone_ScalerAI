"""Serialisation + domain logic shared by REST routers and the WebSocket layer."""
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from . import models as M
from .ws_manager import manager

utcnow = M.utcnow


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat(timespec="milliseconds") + "Z" if dt else None


# ───────────────────────── serialisers ─────────────────────────
def user_out(u: M.User) -> dict:
    return {
        "id": u.id, "phone": u.phone, "username": u.username, "display_name": u.display_name,
        "about": u.about, "avatar_color": u.avatar_color, "avatar_url": u.avatar_url,
        "online": manager.is_online(u.id), "last_seen_at": iso(u.last_seen_at),
    }


def mini_user(u: M.User | None) -> dict | None:
    if not u:
        return None
    return {"id": u.id, "display_name": u.display_name, "avatar_color": u.avatar_color, "avatar_url": u.avatar_url}


def visible_filter(conv_id: int, joined_at: datetime):
    return and_(
        M.Message.conversation_id == conv_id,
        M.Message.created_at >= joined_at,
        or_(M.Message.expires_at.is_(None), M.Message.expires_at > utcnow()),
    )


def _status(receipts: list[M.Receipt]) -> tuple[str, dict]:
    total = len(receipts)
    delivered = sum(1 for r in receipts if r.delivered_at)
    read = sum(1 for r in receipts if r.read_at)
    if total and read == total:
        st = "read"
    elif total and delivered == total:
        st = "delivered"
    else:
        st = "sent"
    return st, {"delivered": delivered, "read": read, "total": total}


def serialize_messages(db: Session, msgs: list[M.Message]) -> list[dict]:
    if not msgs:
        return []
    ids = [m.id for m in msgs]
    receipts: dict[int, list[M.Receipt]] = defaultdict(list)
    for r in db.scalars(select(M.Receipt).where(M.Receipt.message_id.in_(ids))):
        receipts[r.message_id].append(r)
    reactions: dict[int, list[M.Reaction]] = defaultdict(list)
    for r in db.scalars(select(M.Reaction).where(M.Reaction.message_id.in_(ids)).order_by(M.Reaction.id)):
        reactions[r.message_id].append(r)
    reply_ids = {m.reply_to_id for m in msgs if m.reply_to_id}
    replies = {m.id: m for m in db.scalars(select(M.Message).where(M.Message.id.in_(reply_ids)))} if reply_ids else {}
    uids = {m.sender_id for m in msgs if m.sender_id} | {m.sender_id for m in replies.values() if m.sender_id}
    users = {u.id: u for u in db.scalars(select(M.User).where(M.User.id.in_(uids)))} if uids else {}
    member_cache: dict[int, set[int]] = {}

    def members(cid: int) -> set[int]:
        if cid not in member_cache:
            member_cache[cid] = set(db.scalars(select(M.ConversationMember.user_id).where(M.ConversationMember.conversation_id == cid)))
        return member_cache[cid]

    out = []
    for m in msgs:
        recips = [r for r in receipts.get(m.id, []) if r.user_id in members(m.conversation_id)]
        status, counts = _status(recips) if m.kind == "text" else (None, None)
        grouped: dict[str, list[int]] = {}
        for r in reactions.get(m.id, []):
            grouped.setdefault(r.emoji, []).append(r.user_id)
        reply = None
        if m.reply_to_id and m.reply_to_id in replies:
            rm = replies[m.reply_to_id]
            ru = users.get(rm.sender_id)
            reply = {
                "id": rm.id, "sender_id": rm.sender_id, "sender_name": ru.display_name if ru else "Unknown",
                "body": "" if rm.is_deleted else rm.body[:140], "attachment_type": None if rm.is_deleted else rm.attachment_type,
                "is_deleted": rm.is_deleted,
            }
        out.append({
            "id": m.id, "conversation_id": m.conversation_id, "sender_id": m.sender_id,
            "sender": mini_user(users.get(m.sender_id)), "kind": m.kind,
            "body": "" if m.is_deleted else m.body, "is_deleted": m.is_deleted, "reply_to": reply,
            "attachment": None if (m.is_deleted or not m.attachment_url) else {
                "url": m.attachment_url, "name": m.attachment_name, "type": m.attachment_type, "size": m.attachment_size},
            "client_id": m.client_id, "created_at": iso(m.created_at), "expires_at": iso(m.expires_at),
            "status": status, "receipts": counts,
            "reactions": [] if m.is_deleted else [{"emoji": e, "count": len(u), "user_ids": u} for e, u in grouped.items()],
        })
    return out


def serialize_message(db: Session, m: M.Message) -> dict:
    return serialize_messages(db, [m])[0]


def status_updates(db: Session, msgs: list[M.Message]) -> list[dict]:
    return [{"id": d["id"], "status": d["status"], "receipts": d["receipts"]} for d in serialize_messages(db, msgs)]


def get_member(db: Session, conv_id: int, user_id: int) -> M.ConversationMember | None:
    return db.scalar(select(M.ConversationMember).where(
        M.ConversationMember.conversation_id == conv_id, M.ConversationMember.user_id == user_id))


def require_member(db: Session, conv_id: int, user_id: int) -> tuple[M.Conversation, M.ConversationMember]:
    conv = db.get(M.Conversation, conv_id)
    mem = get_member(db, conv_id, user_id) if conv else None
    if not conv or not mem:
        raise HTTPException(404, "Conversation not found")
    return conv, mem


def require_admin(db: Session, conv_id: int, user_id: int) -> M.Conversation:
    conv, mem = require_member(db, conv_id, user_id)
    if conv.type != "group":
        raise HTTPException(400, "Only groups have members to manage")
    if mem.role != "admin":
        raise HTTPException(403, "Only group admins can do that")
    return conv


def member_ids(db: Session, conv_id: int) -> list[int]:
    return list(db.scalars(select(M.ConversationMember.user_id).where(M.ConversationMember.conversation_id == conv_id)))


def conversation_out(db: Session, conv: M.Conversation, viewer_id: int) -> dict:
    rows = db.execute(
        select(M.ConversationMember, M.User).join(M.User, M.User.id == M.ConversationMember.user_id)
        .where(M.ConversationMember.conversation_id == conv.id).order_by(M.ConversationMember.id)).all()
    mine = next((m for m, u in rows if u.id == viewer_id), None)
    joined = mine.joined_at if mine else utcnow()
    members = [{**user_out(u), "role": m.role, "joined_at": iso(m.joined_at)} for m, u in rows]
    peer = next((x for x in members if x["id"] != viewer_id), None) if conv.type == "direct" else None
    last = db.scalars(select(M.Message).where(visible_filter(conv.id, joined)).order_by(M.Message.id.desc()).limit(1)).first()
    unread = db.scalar(
        select(func.count()).select_from(M.Receipt).join(M.Message, M.Message.id == M.Receipt.message_id)
        .where(M.Receipt.user_id == viewer_id, M.Receipt.read_at.is_(None), visible_filter(conv.id, joined))) or 0
    title = peer["display_name"] if peer else (conv.name or "Group")
    return {
        "id": conv.id, "type": conv.type, "title": title, "name": conv.name, "avatar_color": conv.avatar_color,
        "peer": peer, "members": members, "my_role": mine.role if mine else None,
        "created_by": conv.created_by, "disappear_after": conv.disappear_after,
        "created_at": iso(conv.created_at), "updated_at": iso(conv.updated_at),
        "last_message": serialize_message(db, last) if last else None, "unread_count": unread,
    }


# ───────────────────────── pushes ─────────────────────────
async def push_conversation(db: Session, conv: M.Conversation, only: list[int] | None = None) -> None:
    for uid in (only if only is not None else member_ids(db, conv.id)):
        if manager.is_online(uid):
            await manager.send_user(uid, {"type": "conversation.updated", "conversation": conversation_out(db, conv, uid)})


async def create_message(
    db: Session, conv: M.Conversation, sender_id: int | None, body: str = "", *, kind: str = "text",
    client_id: str | None = None, reply_to_id: int | None = None, attachment: dict | None = None,
) -> dict:
    mids = member_ids(db, conv.id)
    t = utcnow()
    m = M.Message(
        conversation_id=conv.id, sender_id=sender_id, kind=kind, body=body, reply_to_id=reply_to_id, client_id=client_id,
        created_at=t, expires_at=t + timedelta(seconds=conv.disappear_after) if conv.disappear_after else None,
        **({f"attachment_{k}": v for k, v in attachment.items()} if attachment else {}),
    )
    db.add(m)
    db.flush()
    if kind == "text":
        for uid in mids:
            if uid != sender_id:
                db.add(M.Receipt(message_id=m.id, user_id=uid, delivered_at=t if manager.is_online(uid) else None))
    conv.updated_at = t
    db.commit()
    data = serialize_message(db, m)
    await manager.send_users(mids, {"type": "message.new", "message": data})
    return data


async def system_message(db: Session, conv: M.Conversation, text: str, actor_id: int | None = None) -> None:
    await create_message(db, conv, actor_id, text, kind="system")


async def mark_read(db: Session, conv_id: int, uid: int) -> int:
    t = utcnow()
    rows = db.execute(
        select(M.Receipt, M.Message).join(M.Message, M.Message.id == M.Receipt.message_id)
        .where(M.Receipt.user_id == uid, M.Receipt.read_at.is_(None), M.Message.conversation_id == conv_id)).all()
    for r, _ in rows:
        r.read_at = t
        r.delivered_at = r.delivered_at or t
    db.commit()
    by_sender: dict[int, list[M.Message]] = defaultdict(list)
    for _, m in rows:
        if m.sender_id:
            by_sender[m.sender_id].append(m)
    for sid, msgs in by_sender.items():
        await manager.send_user(sid, {"type": "message.status", "conversation_id": conv_id, "updates": status_updates(db, msgs)})
    await manager.send_user(uid, {"type": "conversation.read", "conversation_id": conv_id})
    return len(rows)


async def deliver_pending(db: Session, uid: int) -> None:
    """Called when a user connects: everything addressed to them becomes 'delivered'."""
    t = utcnow()
    rows = db.execute(
        select(M.Receipt, M.Message).join(M.Message, M.Message.id == M.Receipt.message_id)
        .where(M.Receipt.user_id == uid, M.Receipt.delivered_at.is_(None))).all()
    for r, _ in rows:
        r.delivered_at = t
    db.commit()
    grouped: dict[tuple[int, int], list[M.Message]] = defaultdict(list)
    for _, m in rows:
        if m.sender_id:
            grouped[(m.sender_id, m.conversation_id)].append(m)
    for (sid, cid), msgs in grouped.items():
        await manager.send_user(sid, {"type": "message.status", "conversation_id": cid, "updates": status_updates(db, msgs)})


def presence_audience(db: Session, uid: int) -> set[int]:
    cids = select(M.ConversationMember.conversation_id).where(M.ConversationMember.user_id == uid)
    return set(db.scalars(select(M.ConversationMember.user_id).where(
        M.ConversationMember.conversation_id.in_(cids), M.ConversationMember.user_id != uid)))


async def broadcast_presence(db: Session, uid: int, online: bool) -> None:
    u = db.get(M.User, uid)
    await manager.send_users(presence_audience(db, uid), {
        "type": "presence", "user_id": uid, "online": online, "last_seen_at": iso(u.last_seen_at if u else None)})


def get_or_create_direct(db: Session, a: int, b: int) -> tuple[M.Conversation, bool]:
    key = f"{min(a, b)}:{max(a, b)}"
    conv = db.scalar(select(M.Conversation).where(M.Conversation.direct_key == key))
    if conv:
        return conv, False
    t = utcnow()
    conv = M.Conversation(type="direct", direct_key=key, created_by=a, created_at=t, updated_at=t)
    db.add(conv)
    db.flush()
    for uid in (a, b):
        db.add(M.ConversationMember(conversation_id=conv.id, user_id=uid, role="member", joined_at=t))
    db.commit()
    return conv, True
