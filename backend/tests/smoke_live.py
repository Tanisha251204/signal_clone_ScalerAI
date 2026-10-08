"""Live smoke test against a RUNNING server (real HTTP + real WebSockets, no TestClient).

Usage:  python tests/smoke_live.py http://localhost:8000 [frontend-origin]
"""
import asyncio
import json
import sys

import httpx
import websockets

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8000"
ORIGIN = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:3000"
WS = BASE.replace("http", "ws", 1)
results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))


async def recv_until(ws, typ, match=None, timeout=5):
    async def loop():
        while True:
            ev = json.loads(await ws.recv())
            if ev["type"] == typ and (match is None or match(ev)):
                return ev
    return await asyncio.wait_for(loop(), timeout)


async def main() -> None:
    async with httpx.AsyncClient(base_url=BASE, timeout=10) as c:
        r = await c.get("/api/health")
        check("health endpoint", r.status_code == 200)
        r = await c.options("/api/me", headers={"Origin": ORIGIN, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization"})
        check("CORS preflight allows frontend origin", r.status_code == 200 and r.headers.get("access-control-allow-origin") in ("*", ORIGIN), str(r.headers))

        # AUTH: register -> OTP -> login -> persistence -> logout
        r = await c.post("/api/auth/request-otp", json={"identifier": "+91 90000 12345"})
        check("request-otp returns mocked code", r.json().get("otp_hint") == "123456")
        r = await c.post("/api/auth/register", json={"identifier": "+91 90000 12345", "otp": "123456", "display_name": "Smoke Tester"})
        check("register new user", r.status_code == 200, r.text)
        tok_new = r.json()["token"]
        check("session persists (GET /me)", (await c.get("/api/me", headers={"Authorization": f"Bearer {tok_new}"})).json()["display_name"] == "Smoke Tester")
        await c.post("/api/auth/logout", headers={"Authorization": f"Bearer {tok_new}"})
        check("logout invalidates token", (await c.get("/api/me", headers={"Authorization": f"Bearer {tok_new}"})).status_code == 401)
        r = await c.post("/api/auth/login", json={"identifier": "+919000012345", "otp": "123456"})
        check("login after logout", r.status_code == 200)

        la = (await c.post("/api/auth/login", json={"identifier": "+919810000001", "otp": "123456"})).json()
        lp = (await c.post("/api/auth/login", json={"identifier": "+919810000002", "otp": "123456"})).json()
        ha = {"Authorization": f"Bearer {la['token']}"}
        hp = {"Authorization": f"Bearer {lp['token']}"}
        aid, pid = la["user"]["id"], lp["user"]["id"]

        convs = (await c.get("/api/conversations", headers=ha)).json()
        check("seeded conversations present (>=7, incl. groups)", len(convs) >= 7 and any(x["type"] == "group" for x in convs), str(len(convs)))
        check("conversations sorted by recent activity", all(convs[i]["updated_at"] >= convs[i + 1]["updated_at"] for i in range(len(convs) - 1)))
        check("unread counts + last-message preview", any(x["unread_count"] > 0 for x in convs) and all(x["last_message"] for x in convs if x["type"] == "group"))

        cid = (await c.post("/api/conversations/direct", headers=ha, json={"user_id": pid})).json()["id"]

        # REALTIME: two simultaneous sockets
        async with websockets.connect(f"{WS}/ws?token={la['token']}") as wa, websockets.connect(f"{WS}/ws?token={lp['token']}") as wp:
            ra = await recv_until(wa, "ready")
            await recv_until(wp, "ready")
            check("websocket handshake + ready (A)", ra["user_id"] == aid)
            pres = await recv_until(wa, "presence", lambda e: e["user_id"] == pid, 3) if False else None

            m = (await c.post(f"/api/conversations/{cid}/messages", headers=ha, json={"body": "hello over ws", "client_id": "live-1"})).json()
            ev = await recv_until(wp, "message.new", lambda e: e["message"]["body"] == "hello over ws")
            check("B receives A's message instantly", ev["message"]["id"] == m["id"])
            check("receipt starts delivered (B online)", m["status"] == "delivered", m["status"])

            await wa.send(json.dumps({"type": "typing", "conversation_id": cid, "is_typing": True}))
            t = await recv_until(wp, "typing")
            check("typing indicator A -> B", t["is_typing"] and t["user_id"] == aid)

            await wp.send(json.dumps({"type": "read", "conversation_id": cid}))
            st = await recv_until(wa, "message.status", lambda e: any(u["status"] == "read" for u in e["updates"]))
            check("read receipt B -> A", st["updates"][0]["status"] == "read")

            # reconnect: persisted + not lost
            persisted = (await c.get(f"/api/conversations/{cid}/messages", headers=hp)).json()["messages"]
            check("message persisted (refresh keeps it)", any(x["body"] == "hello over ws" for x in persisted))

            # GROUP
            g = (await c.post("/api/conversations/group", headers=ha, json={"name": "Live Group", "member_ids": [pid]})).json()
            await recv_until(wp, "conversation.updated", lambda e: e["conversation"]["title"] == "Live Group")
            check("group created, member notified live", g["my_role"] == "admin")
            await c.post(f"/api/conversations/{g['id']}/messages", headers=hp, json={"body": "group hi"})
            await recv_until(wa, "message.new", lambda e: e["message"]["body"] == "group hi")
            check("group message reaches admin", True)
            r = await c.post(f"/api/conversations/{g['id']}/members", headers=hp, json={"user_ids": [3]})
            check("non-admin cannot add members (403)", r.status_code == 403)
            r = await c.delete(f"/api/conversations/{g['id']}/members/{pid}", headers=ha)
            await recv_until(wp, "conversation.removed")
            check("admin removes member; member notified", r.status_code == 200)
            check("removed member loses access", (await c.get(f"/api/conversations/{g['id']}/messages", headers=hp)).status_code == 404)

        # offline delivery then reconnect: 'sent' -> 'delivered'
        m2 = (await c.post(f"/api/conversations/{cid}/messages", headers=ha, json={"body": "while you were away"})).json()
        check("offline recipient -> status 'sent'", m2["status"] == "sent", m2["status"])
        async with websockets.connect(f"{WS}/ws?token={la['token']}") as wa2:
            await recv_until(wa2, "ready")
            async with websockets.connect(f"{WS}/ws?token={lp['token']}") as wp2:
                await recv_until(wp2, "ready")
                st = await recv_until(wa2, "message.status", lambda e: any(u["id"] == m2["id"] and u["status"] == "delivered" for u in e["updates"]))
                check("reconnect upgrades sent -> delivered", True)

        s = (await c.get("/api/search", headers=ha, params={"q": "websocket"})).json()
        check("message search", bool(s["messages"]))
        check("conversation/contact search", bool((await c.get("/api/search", headers=ha, params={"q": "priya"})).json()["conversations"]))

        # bad websocket token is rejected
        try:
            async with websockets.connect(f"{WS}/ws?token=bogus") as bad:
                await asyncio.wait_for(bad.recv(), 3)
            check("websocket rejects bad token", False)
        except websockets.exceptions.ConnectionClosed as e:
            check("websocket rejects bad token", e.rcvd is not None and e.rcvd.code == 4401)

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    sys.exit(1 if failed else 0)


asyncio.run(main())
