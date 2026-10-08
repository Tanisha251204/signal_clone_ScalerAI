from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    """Tracks live sockets per user (a user can have several tabs/devices)."""

    def __init__(self) -> None:
        self.conns: dict[int, set[WebSocket]] = defaultdict(set)

    def add(self, uid: int, ws: WebSocket) -> None:
        self.conns[uid].add(ws)

    def remove(self, uid: int, ws: WebSocket) -> None:
        self.conns[uid].discard(ws)
        if not self.conns[uid]:
            self.conns.pop(uid, None)

    def is_online(self, uid: int) -> bool:
        return bool(self.conns.get(uid))

    def online_ids(self) -> set[int]:
        return set(self.conns.keys())

    async def send_user(self, uid: int, payload: dict) -> None:
        for ws in list(self.conns.get(uid, ())):
            try:
                await ws.send_json(payload)
            except Exception:
                self.conns[uid].discard(ws)

    async def send_users(self, uids, payload: dict) -> None:
        for uid in set(uids):
            await self.send_user(uid, payload)


manager = ConnectionManager()
