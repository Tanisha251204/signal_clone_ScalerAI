import time

from .conftest import login


def drain(ws, want, limit=20, match=None):
    """Read events until one of type `want` (and satisfying `match`) arrives."""
    for _ in range(limit):
        ev = ws.receive_json()
        if ev["type"] == want and (match is None or match(ev)):
            return ev
    raise AssertionError(f"never received {want}")


# ───────── AUTH ─────────
def test_register_otp_login_logout(client):
    r = client.post("/api/auth/request-otp", json={"identifier": "+91 99999 11111"})
    assert r.json()["exists"] is False and r.json()["otp_hint"] == "123456"
    assert client.post("/api/auth/register", json={"identifier": "+91 99999 11111", "otp": "000000", "display_name": "Zed"}).status_code == 400
    r = client.post("/api/auth/register", json={"identifier": "+91 99999 11111", "otp": "123456", "display_name": "Zed", "avatar_color": "#112233"})
    assert r.status_code == 200
    token = r.json()["token"]
    h = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/me", headers=h).json()["display_name"] == "Zed"  # session persistence
    assert client.post("/api/auth/register", json={"identifier": "+919999911111", "otp": "123456", "display_name": "Dup"}).status_code == 409
    assert client.post("/api/auth/logout", headers=h).status_code == 200
    assert client.get("/api/me", headers=h).status_code == 401
    assert login(client, "+919999911111")[2]["display_name"] == "Zed"


def test_username_registration(client):
    r = client.post("/api/auth/register", json={"identifier": "@Cool_User", "otp": "123456", "display_name": "Cool"})
    assert r.status_code == 200 and r.json()["user"]["username"] == "cool_user" and r.json()["user"]["phone"] is None
    assert client.post("/api/auth/login", json={"identifier": "cool_user", "otp": "123456"}).status_code == 200


def test_profile_update(client, aarav):
    _, h, _ = aarav
    r = client.patch("/api/me", headers=h, json={"about": "Hello there", "avatar_color": "#ABCDEF"})
    assert r.json()["about"] == "Hello there"


def test_unauthenticated_blocked(client):
    assert client.get("/api/conversations").status_code == 401


# ───────── SEED / LIST ─────────
def test_seed_populated(client, aarav):
    _, h, _ = aarav
    convs = client.get("/api/conversations", headers=h).json()
    assert len(convs) >= 7
    assert any(c["type"] == "group" for c in convs)
    assert all(convs[i]["updated_at"] >= convs[i + 1]["updated_at"] for i in range(len(convs) - 1))  # sorted by recent
    karan = next(c for c in convs if c["title"] == "Karan Singh")
    assert karan["unread_count"] == 3 and karan["last_message"]["body"]


# ───────── DIRECT CHAT + RECEIPTS + TYPING (two live sessions) ─────────
def test_direct_chat_realtime_receipts_typing(client, aarav, priya):
    ta, ha, ua = aarav
    tp, hp, up = priya
    conv = client.post("/api/conversations/direct", headers=ha, json={"user_id": up["id"]}).json()
    cid = conv["id"]
    with client.websocket_connect(f"/ws?token={ta}") as wa:
        assert drain(wa, "ready")["user_id"] == ua["id"]
        # priya offline: message stays 'sent'
        m1 = client.post(f"/api/conversations/{cid}/messages", headers=ha, json={"body": "offline hello", "client_id": "c-1"}).json()
        assert m1["status"] == "sent"
        # idempotent retry
        assert client.post(f"/api/conversations/{cid}/messages", headers=ha, json={"body": "offline hello", "client_id": "c-1"}).json()["id"] == m1["id"]
        # priya connects → delivered event reaches aarav
        with client.websocket_connect(f"/ws?token={tp}") as wp:
            drain(wp, "ready")
            ev = drain(wa, "message.status")
            assert ev["updates"][0]["status"] == "delivered"
            # live message A -> B
            m2 = client.post(f"/api/conversations/{cid}/messages", headers=ha, json={"body": "live ping"}).json()
            assert m2["status"] == "delivered"
            assert drain(wp, "message.new", match=lambda e: e["message"]["body"] == "live ping")
            # typing
            wa.send_json({"type": "typing", "conversation_id": cid, "is_typing": True})
            t = drain(wp, "typing")
            assert t["is_typing"] and t["user_id"] == ua["id"]
            # read receipt
            wp.send_json({"type": "read", "conversation_id": cid})
            st = drain(wa, "message.status")
            assert {u["status"] for u in st["updates"]} == {"read"}
    # persistence
    msgs = client.get(f"/api/conversations/{cid}/messages", headers=hp).json()["messages"]
    assert [m["body"] for m in msgs][-2:] == ["offline hello", "live ping"]
    assert all(m["status"] == "read" for m in client.get(f"/api/conversations/{cid}/messages", headers=ha).json()["messages"])
    # unread count cleared for priya, conv ordered first
    lst = client.get("/api/conversations", headers=hp).json()
    assert lst[0]["id"] == cid and lst[0]["unread_count"] == 0


def test_unread_and_mark_read(client, aarav, rohan):
    _, ha, ua = aarav
    _, hr, ur = rohan
    cid = client.post("/api/conversations/direct", headers=ha, json={"user_id": ur["id"]}).json()["id"]
    client.post(f"/api/conversations/{cid}/messages", headers=hr, json={"body": "u1"})
    client.post(f"/api/conversations/{cid}/messages", headers=hr, json={"body": "u2"})
    c = next(c for c in client.get("/api/conversations", headers=ha).json() if c["id"] == cid)
    assert c["unread_count"] >= 2
    client.post(f"/api/conversations/{cid}/read", headers=ha)
    c = next(c for c in client.get("/api/conversations", headers=ha).json() if c["id"] == cid)
    assert c["unread_count"] == 0


def test_non_member_cannot_read(client, priya, rohan):
    _, hp, _ = priya
    _, hr, ur = rohan
    # Aarav<->Karan conv id from seed; priya is not a member of Aarav-Rohan DM
    convs = client.get("/api/conversations", headers=hr).json()
    cid = convs[0]["id"]
    other = [c for c in client.get("/api/conversations", headers=hp).json()]
    mine = {c["id"] for c in other}
    foreign = next(c["id"] for c in convs if c["id"] not in mine)
    assert client.get(f"/api/conversations/{foreign}/messages", headers=hp).status_code == 404
    assert client.post(f"/api/conversations/{foreign}/messages", headers=hp, json={"body": "x"}).status_code == 404


# ───────── GROUPS ─────────
def test_group_lifecycle_and_admin_enforcement(client, aarav, priya, rohan):
    ta, ha, ua = aarav
    tp, hp, up = priya
    tr, hr, ur = rohan
    g = client.post("/api/conversations/group", headers=ha, json={"name": "Test Squad", "member_ids": [up["id"]]}).json()
    gid = g["id"]
    assert g["my_role"] == "admin" and len(g["members"]) == 2
    with client.websocket_connect(f"/ws?token={tp}") as wp:
        drain(wp, "ready")
        # non-admin cannot add / rename
        assert client.post(f"/api/conversations/{gid}/members", headers=hp, json={"user_ids": [ur["id"]]}).status_code == 403
        assert client.patch(f"/api/conversations/{gid}", headers=hp, json={"name": "Hack"}).status_code == 403
        # admin adds rohan
        r = client.post(f"/api/conversations/{gid}/members", headers=ha, json={"user_ids": [ur["id"]]})
        assert r.status_code == 200 and len(r.json()["members"]) == 3
        drain(wp, "conversation.updated")
        # group message reaches everyone
        client.post(f"/api/conversations/{gid}/messages", headers=hr, json={"body": "hi squad"})
        assert drain(wp, "message.new", match=lambda e: e["message"]["body"] == "hi squad")
        msgs = client.get(f"/api/conversations/{gid}/messages", headers=hp).json()["messages"]
        assert any(m["body"] == "hi squad" for m in msgs)
        # admin removes rohan; rohan loses access
        assert client.delete(f"/api/conversations/{gid}/members/{ur['id']}", headers=hp).status_code == 403
        assert client.delete(f"/api/conversations/{gid}/members/{ur['id']}", headers=ha).status_code == 200
        assert client.get(f"/api/conversations/{gid}/messages", headers=hr).status_code == 404
        # promote priya, then she can rename
        assert client.patch(f"/api/conversations/{gid}/members/{up['id']}", headers=ha, json={"role": "admin"}).status_code == 200
        assert client.patch(f"/api/conversations/{gid}", headers=hp, json={"name": "Renamed"}).json()["title"] == "Renamed"
    # group read receipts need everyone
    gm = client.post(f"/api/conversations/{gid}/messages", headers=ha, json={"body": "after"}).json()
    assert gm["receipts"]["total"] == 1
    # last admin leaving promotes someone else
    assert client.delete(f"/api/conversations/{gid}/members/{ua['id']}", headers=ha).status_code == 200
    assert client.get(f"/api/conversations/{gid}", headers=hp).json()["my_role"] == "admin"


def test_group_validation(client, aarav):
    _, ha, _ = aarav
    assert client.post("/api/conversations/group", headers=ha, json={"name": "x", "member_ids": []}).status_code == 422
    assert client.post("/api/conversations/group", headers=ha, json={"name": "x", "member_ids": [99999]}).status_code == 400


# ───────── SEARCH / CONTACTS ─────────
def test_search_and_contacts(client, aarav):
    _, ha, _ = aarav
    s = client.get("/api/search", headers=ha, params={"q": "priya"}).json()
    assert any(c["title"] == "Priya Patel" for c in s["conversations"]) and s["contacts"]
    s = client.get("/api/search", headers=ha, params={"q": "trek"}).json()
    assert any("Trek" in c["title"] for c in s["conversations"]) or s["messages"]
    s = client.get("/api/search", headers=ha, params={"q": "websocket"}).json()
    assert s["messages"] and "websocket" in s["messages"][0]["message"]["body"].lower()
    found = client.get("/api/users/search", headers=ha, params={"q": "Vikram"}).json()
    assert found and found[0]["display_name"] == "Vikram Rao"
    assert client.post("/api/contacts", headers=ha, json={"user_id": found[0]["id"]}).status_code == 200
    assert any(c["display_name"] == "Vikram Rao" for c in client.get("/api/contacts", headers=ha).json())


# ───────── BONUS: reactions / reply / delete / disappearing ─────────
def test_reaction_reply_delete(client, aarav, priya):
    _, ha, _ = aarav
    _, hp, up = priya
    cid = client.post("/api/conversations/direct", headers=ha, json={"user_id": up["id"]}).json()["id"]
    m = client.post(f"/api/conversations/{cid}/messages", headers=hp, json={"body": "original"}).json()
    r = client.post(f"/api/conversations/{cid}/messages", headers=ha, json={"body": "replying", "reply_to_id": m["id"]}).json()
    assert r["reply_to"]["body"] == "original"
    rx = client.post(f"/api/messages/{m['id']}/reactions", headers=ha, json={"emoji": "👍"}).json()
    assert rx["reactions"][0]["count"] == 1
    assert client.post(f"/api/messages/{m['id']}/reactions", headers=ha, json={"emoji": "👍"}).json()["reactions"] == []  # toggle off
    assert client.delete(f"/api/messages/{m['id']}", headers=ha).status_code == 403
    d = client.delete(f"/api/messages/{m['id']}", headers=hp).json()
    assert d["is_deleted"] and d["body"] == ""


def test_disappearing_messages(client, aarav, priya):
    _, ha, _ = aarav
    _, hp, up = priya
    cid = client.post("/api/conversations/direct", headers=ha, json={"user_id": up["id"]}).json()["id"]
    assert client.patch(f"/api/conversations/{cid}", headers=ha, json={"disappear_after": 30}).json()["disappear_after"] == 30
    m = client.post(f"/api/conversations/{cid}/messages", headers=ha, json={"body": "vanish"}).json()
    assert m["expires_at"]
    client.patch(f"/api/conversations/{cid}", headers=ha, json={"clear_disappear": True})


def test_attachment_upload(client, aarav, priya):
    _, ha, _ = aarav
    _, _, up = priya
    r = client.post("/api/uploads", headers=ha, files={"file": ("a.txt", b"hello", "text/plain")})
    assert r.status_code == 200
    up_ = r.json()
    assert client.get(up_["url"]).content == b"hello"
    cid = client.post("/api/conversations/direct", headers=ha, json={"user_id": up["id"]}).json()["id"]
    m = client.post(f"/api/conversations/{cid}/messages", headers=ha, json={
        "attachment_url": up_["url"], "attachment_name": "a.txt", "attachment_type": "text/plain", "attachment_size": 5}).json()
    assert m["attachment"]["name"] == "a.txt"


def test_active_content_uploads_are_not_served_as_web_pages(client, aarav):
    _, ha, _ = aarav
    r = client.post("/api/uploads", headers=ha, files={"file": ("evil.html", b"<script>alert(1)</script>", "text/html")})
    assert r.status_code == 200 and r.json()["url"].endswith(".bin")
    served = client.get(r.json()["url"])
    assert "text/html" not in served.headers["content-type"]
    assert client.post("/api/uploads", headers=ha, files={"file": ("big.bin", b"x" * (10 * 1024 * 1024 + 1), "application/octet-stream")}).status_code == 413
    assert client.post("/api/uploads", files={"file": ("a.txt", b"x", "text/plain")}).status_code == 401


# ───────── HARDENING (added after self-audit) ─────────
def test_blank_names_are_rejected(client, aarav):
    _, ha, _ = aarav
    reg = {"identifier": "+919777700001", "otp": "123456", "display_name": "   "}
    assert client.post("/api/auth/register", json=reg).status_code == 422
    assert client.post("/api/conversations/group", headers=ha, json={"name": "   ", "member_ids": [2]}).status_code == 422
    assert client.patch("/api/me", headers=ha, json={"display_name": "  "}).status_code == 422


def test_untrusted_fields_are_validated(client, aarav, priya):
    _, ha, _ = aarav
    bad_color = {"identifier": "+919777700002", "otp": "123456", "display_name": "X", "avatar_color": "red;background:url(x)"}
    assert client.post("/api/auth/register", json=bad_color).status_code == 422
    conv = client.post("/api/conversations/direct", headers=ha, json={"user_id": priya[2]["id"]}).json()
    for url in ("/uploads/../signal.db", "https://evil.example/x.png", "/uploads/nothex.png"):
        r = client.post(f"/api/conversations/{conv['id']}/messages", headers=ha, json={"body": "x", "attachment_url": url})
        assert r.status_code in (400, 422), url


def test_client_id_is_idempotent(client, aarav, priya):
    _, ha, _ = aarav
    conv = client.post("/api/conversations/direct", headers=ha, json={"user_id": priya[2]["id"]}).json()
    body = {"body": "once only", "client_id": "retry-123"}
    a = client.post(f"/api/conversations/{conv['id']}/messages", headers=ha, json=body).json()
    b = client.post(f"/api/conversations/{conv['id']}/messages", headers=ha, json=body).json()
    assert a["id"] == b["id"]


def test_custom_disappearing_timer_bounds(client, aarav, priya):
    """4 weeks and custom values are accepted; 0 and anything beyond 4 weeks is rejected."""
    _, ha, _ = aarav
    cid = client.post("/api/conversations/direct", headers=ha, json={"user_id": priya[2]["id"]}).json()["id"]
    patch = lambda body: client.patch(f"/api/conversations/{cid}", headers=ha, json=body)
    assert patch({"disappear_after": 28 * 86400}).json()["disappear_after"] == 2419200
    assert patch({"disappear_after": 90}).json()["disappear_after"] == 90
    assert patch({"disappear_after": 0}).status_code == 400
    assert patch({"disappear_after": 28 * 86400 + 1}).status_code == 400
    assert patch({"disappear_after": -5}).status_code == 400
    patch({"clear_disappear": True})


def test_health_answers_head_for_uptime_monitors(client):
    assert client.get("/api/health").status_code == 200
    assert client.head("/api/health").status_code == 200
