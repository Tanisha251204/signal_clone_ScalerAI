from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .. import models as M
from ..database import get_db
from ..security import current_user
from ..services import conversation_out, serialize_messages, user_out, utcnow

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search")
def search(q: str = "", user: M.User = Depends(current_user), db: Session = Depends(get_db)):
    """Search my conversations (by title / member), my contacts, and message text."""
    q = q.strip()
    if not q:
        return {"conversations": [], "contacts": [], "messages": []}
    like = f"%{q}%"
    convs = db.scalars(
        select(M.Conversation).join(M.ConversationMember, M.ConversationMember.conversation_id == M.Conversation.id)
        .where(M.ConversationMember.user_id == user.id).order_by(M.Conversation.updated_at.desc())).all()
    conv_hits = []
    for c in convs:
        d = conversation_out(db, c, user.id)
        if c.type == "direct" and not d["last_message"] and c.created_by != user.id:
            continue
        if q.lower() in d["title"].lower() or any(q.lower() in (m["display_name"] or "").lower() for m in d["members"]):
            conv_hits.append(d)
    contacts = db.scalars(
        select(M.User).join(M.Contact, M.Contact.contact_id == M.User.id)
        .where(M.Contact.owner_id == user.id, or_(M.User.display_name.ilike(like), M.User.username.ilike(like), M.User.phone.like(like)))
        .order_by(M.User.display_name).limit(20)).all()
    msgs = db.execute(
        select(M.Message, M.Conversation).join(M.Conversation, M.Conversation.id == M.Message.conversation_id)
        .join(M.ConversationMember, (M.ConversationMember.conversation_id == M.Conversation.id) & (M.ConversationMember.user_id == user.id))
        .where(M.Message.kind == "text", M.Message.is_deleted.is_(False), M.Message.body.ilike(like),
               M.Message.created_at >= M.ConversationMember.joined_at,
               or_(M.Message.expires_at.is_(None), M.Message.expires_at > utcnow()))
        .order_by(M.Message.id.desc()).limit(25)).all()
    serialized = serialize_messages(db, [m for m, _ in msgs])
    titles = {c.id: conversation_out(db, c, user.id)["title"] for _, c in msgs}
    return {
        "conversations": conv_hits, "contacts": [user_out(u) for u in contacts],
        "messages": [{"message": s, "conversation_id": s["conversation_id"], "conversation_title": titles[s["conversation_id"]]} for s in serialized],
    }
