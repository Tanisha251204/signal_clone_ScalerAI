import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from .. import models as M
from ..database import SessionLocal
from ..security import user_from_token
from ..services import (
    broadcast_presence, deliver_pending, get_member, mark_read, member_ids, presence_audience, utcnow,
)
from ..ws_manager import manager

router = APIRouter()


@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket, token: str = ""):
    with SessionLocal() as db:
        user = user_from_token(db, token)
        uid = user.id if user else None
        name = user.display_name if user else ""
    await ws.accept()
    if uid is None:
        await ws.close(code=4401)
        return
    first = not manager.is_online(uid)
    manager.add(uid, ws)
    try:
        with SessionLocal() as db:
            audience = presence_audience(db, uid)
            await ws.send_json({"type": "ready", "user_id": uid, "online_user_ids": sorted(manager.online_ids() & audience)})
            await deliver_pending(db, uid)
            if first:
                await broadcast_presence(db, uid, True)
        while True:
            try:
                data = json.loads(await ws.receive_text())
            except json.JSONDecodeError:
                continue
            kind = data.get("type")
            if kind == "ping":
                await ws.send_json({"type": "pong"})
            elif kind == "typing":
                cid = data.get("conversation_id")
                with SessionLocal() as db:
                    if isinstance(cid, int) and get_member(db, cid, uid):
                        others = [m for m in member_ids(db, cid) if m != uid]
                        await manager.send_users(others, {"type": "typing", "conversation_id": cid, "user_id": uid,
                                                          "name": name, "is_typing": bool(data.get("is_typing"))})
            elif kind == "read":
                cid = data.get("conversation_id")
                with SessionLocal() as db:
                    if isinstance(cid, int) and get_member(db, cid, uid):
                        await mark_read(db, cid, uid)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        manager.remove(uid, ws)
        if not manager.is_online(uid):
            with SessionLocal() as db:
                u = db.get(M.User, uid)
                if u:
                    u.last_seen_at = utcnow()
                    db.commit()
                await broadcast_presence(db, uid, False)
