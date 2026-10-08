import asyncio
import logging
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from . import models as M
from .config import CORS_ORIGINS, SEED_DEMO_DATA, UPLOAD_DIR
from .database import Base, SessionLocal, engine
from .routers import auth, conversations, realtime, search, users
from .seed import seed_if_empty
from .services import member_ids, push_conversation, utcnow
from .ws_manager import manager

log = logging.getLogger("signal.expiry")


async def expire_messages_loop() -> None:
    """Disappearing messages: delete expired rows and tell the members."""
    while True:
        await asyncio.sleep(2)
        try:
            with SessionLocal() as db:
                expired = db.scalars(select(M.Message).where(M.Message.expires_at.is_not(None), M.Message.expires_at <= utcnow())).all()
                if not expired:
                    continue
                by_conv: dict[int, list[int]] = defaultdict(list)
                for m in expired:
                    by_conv[m.conversation_id].append(m.id)
                    db.delete(m)
                db.commit()
                for cid, ids in by_conv.items():
                    await manager.send_users(member_ids(db, cid), {"type": "message.expired", "conversation_id": cid, "message_ids": ids})
                    conv = db.get(M.Conversation, cid)
                    if conv:
                        await push_conversation(db, conv)
        except Exception:
            log.exception("expiry sweep failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    if SEED_DEMO_DATA:
        with SessionLocal() as db:
            seed_if_empty(db)
    task = asyncio.create_task(expire_messages_loop())
    yield
    task.cancel()


app = FastAPI(title="Signal Clone API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
for r in (auth.router, users.router, conversations.router, search.router, realtime.router):
    app.include_router(r)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok", "online_users": len(manager.online_ids())}
