"""Realistic demo data so the app looks alive on first launch. Idempotent: only runs on an empty DB."""
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models as M
from .services import utcnow

USERS = {  # key: (display name, phone, username, about, colour)
    "aarav": ("Aarav Sharma", "+919810000001", "aarav", "Building things. Speak freely.", "#2C6BED"),
    "priya": ("Priya Patel", "+919810000002", "priya.p", "Coffee first ☕", "#E0457B"),
    "rohan": ("Rohan Mehta", "+919810000003", "rohan_m", "On a run 🏃", "#1B998B"),
    "sneha": ("Sneha Iyer", "+919810000004", "sneha", "Design is thinking made visible", "#8E44AD"),
    "karan": ("Karan Singh", "+919810000005", "karan_s", "Busy — ping me", "#F29D38"),
    "meera": ("Meera Nair", "+919810000006", "meera", "🌿", "#D64545"),
    "vikram": ("Vikram Rao", "+919810000007", "vikram", "Available", "#3D5A80"),
    "ananya": ("Ananya Das", "+919810000008", "ananya", "Privacy matters", "#5B8C5A"),
}

H, D = 60, 60 * 24  # minutes


def seed_if_empty(db: Session) -> None:
    if db.scalar(select(M.User.id).limit(1)):
        return
    now = utcnow()
    u: dict[str, M.User] = {}
    for key, (name, phone, uname, about, color) in USERS.items():
        u[key] = M.User(display_name=name, phone=phone, username=uname, about=about, avatar_color=color,
                        created_at=now - timedelta(days=30), last_seen_at=now - timedelta(minutes=hash(key) % 90 + 5))
        db.add(u[key])
    db.flush()

    for owner in u:  # contacts (Aarav hasn't added Vikram/Ananya yet — find them via search)
        for other in u:
            if owner != other and not (owner == "aarav" and other in ("vikram", "ananya")):
                db.add(M.Contact(owner_id=u[owner].id, contact_id=u[other].id))

    def conv(kind, members, admin=None, name=None, color="#2C6BED", created_days=12):
        t = now - timedelta(days=created_days)
        key = None
        if kind == "direct":
            a, b = sorted(u[k].id for k in members)
            key = f"{a}:{b}"
        c = M.Conversation(type=kind, name=name, avatar_color=color, direct_key=key, created_by=u[members[0]].id,
                           created_at=t, updated_at=t)
        db.add(c)
        db.flush()
        for k in members:
            db.add(M.ConversationMember(conversation_id=c.id, user_id=u[k].id, joined_at=t,
                                        role="admin" if k == admin else "member"))
        return c

    def say(c, sender, text, mins_ago, unread_for=(), reply_to=None, reactions=None):
        t = now - timedelta(minutes=mins_ago)
        m = M.Message(conversation_id=c.id, sender_id=u[sender].id if sender else None, body=text, created_at=t,
                      kind="text", reply_to_id=reply_to.id if reply_to else None)
        db.add(m)
        db.flush()
        c.updated_at = max(c.updated_at, t)
        mems = db.scalars(select(M.ConversationMember).where(M.ConversationMember.conversation_id == c.id)).all()
        for mem in mems:
            if mem.user_id == u[sender].id:
                continue
            name = next(k for k, v in u.items() if v.id == mem.user_id)
            unread = name in unread_for
            db.add(M.Receipt(message_id=m.id, user_id=mem.user_id, delivered_at=t + timedelta(seconds=2),
                             read_at=None if unread else t + timedelta(minutes=2)))
        for who, emoji in (reactions or []):
            db.add(M.Reaction(message_id=m.id, user_id=u[who].id, emoji=emoji))
        return m

    def system(c, text, mins_ago, actor):
        t = now - timedelta(minutes=mins_ago)
        db.add(M.Message(conversation_id=c.id, sender_id=u[actor].id, kind="system", body=text, created_at=t))
        c.updated_at = max(c.updated_at, t)

    # ── Aarav ↔ Priya
    c = conv("direct", ["aarav", "priya"])
    say(c, "priya", "Hey! Did you get a chance to look at the new designs?", 2 * D + 40)
    say(c, "aarav", "Just went through them — the onboarding flow looks really clean 👏", 2 * D + 33)
    m = say(c, "priya", "Thanks! I was a bit unsure about the OTP screen though", 2 * D + 30)
    say(c, "aarav", "The spacing is perfect. Maybe make the resend link a bit more subtle?", 2 * D + 25, reply_to=m)
    say(c, "priya", "Good call, will tweak it.", 2 * D + 20, reactions=[("aarav", "👍")])
    say(c, "aarav", "Are we still on for coffee tomorrow?", 3 * H + 5)
    say(c, "priya", "Yes!! 10:30 at the usual place ☕", 3 * H)
    say(c, "aarav", "Perfect. I'll bring the laptop so we can go over the API together.", 2 * H + 50)
    say(c, "priya", "See you there 🙌", 25, reactions=[("aarav", "❤️")])
    # ── Aarav ↔ Rohan
    c = conv("direct", ["aarav", "rohan"])
    say(c, "rohan", "Bro, did you see the match last night?", 5 * D)
    say(c, "aarav", "Of course. That last over was unreal 😅", 5 * D - 6)
    say(c, "rohan", "Running 5k Sunday morning, you in?", 8 * H)
    say(c, "aarav", "I'll try to make it. Send me the route?", 7 * H + 30)
    say(c, "rohan", "Sent! Starts at 6:30 sharp.", 7 * H)
    # ── Aarav ↔ Sneha
    c = conv("direct", ["aarav", "sneha"])
    say(c, "sneha", "Here's the updated brand palette. Ultramarine is staying 💙", D + 2 * H)
    say(c, "aarav", "Love it. Contrast ratios pass AA across the board.", D + H + 40)
    say(c, "sneha", "Great, handing it over to engineering tomorrow.", D + H)
    # ── Aarav ↔ Karan (unread)
    c = conv("direct", ["aarav", "karan"])
    say(c, "aarav", "Deploy window is at 6pm, right?", 3 * H + 30)
    say(c, "karan", "Yep. Can you review my PR before that?", 70, unread_for=["aarav"])
    say(c, "karan", "It's the websocket reconnect fix. Small diff, I promise.", 68, unread_for=["aarav"])
    say(c, "karan", "Also — CI is green 🟢", 66, unread_for=["aarav"])
    # ── Aarav ↔ Meera
    c = conv("direct", ["aarav", "meera"])
    say(c, "meera", "Don't forget Mom's birthday on Saturday!", 2 * D + 5 * H)
    say(c, "aarav", "Already booked the cake 🎂", 2 * D + 4 * H)
    say(c, "meera", "You're the best.", 2 * D + 4 * H - 10, reactions=[("aarav", "😂")])
    # ── Priya ↔ Rohan / Sneha (visible to other demo logins)
    c = conv("direct", ["priya", "rohan"])
    say(c, "rohan", "Priya, are the slides ready?", 4 * H)
    say(c, "priya", "Almost! Sending in 10.", 4 * H - 3)
    c = conv("direct", ["priya", "sneha"])
    say(c, "sneha", "Can you share the Figma link?", 6 * H)
    say(c, "priya", "Here you go 👉 figma.com/file/signal-demo", 6 * H - 4)

    # ── Groups
    g = conv("group", ["aarav", "priya", "rohan", "sneha", "karan"], admin="aarav", name="Weekend Trek 🏔️", color="#1B998B", created_days=9)
    system(g, "Aarav Sharma created the group", 9 * D, "aarav")
    say(g, "aarav", "Okay team, Triund trek this Saturday. Who's in?", 2 * D + 6 * H)
    say(g, "priya", "Count me in!! 🙋‍♀️", 2 * D + 6 * H - 5)
    say(g, "rohan", "Obviously. I'll drive.", 2 * D + 6 * H - 9, reactions=[("aarav", "🙌"), ("priya", "🚗")])
    say(g, "sneha", "I'll bring snacks and the portable speaker", 2 * D + 5 * H)
    say(g, "karan", "Weather looks clear all weekend ☀️", 5 * H + 20)
    say(g, "aarav", "Meeting point 5:30am at the petrol pump. Don't be late!", 90, unread_for=["priya", "rohan", "sneha"])
    say(g, "priya", "5:30?? Fine. I'll set 3 alarms 😴", 40, unread_for=["aarav"])
    say(g, "rohan", "Bringing extra water bottles for everyone", 32, unread_for=["aarav"])
    say(g, "sneha", "📍 Pinned the route in our shared map", 12, unread_for=["aarav"])

    g = conv("group", ["priya", "aarav", "karan", "meera", "vikram"], admin="priya", name="Project Falcon 🚀", color="#3D5A80", created_days=20)
    system(g, "Priya Patel created the group", 20 * D, "priya")
    say(g, "priya", "Sprint planning moved to 11am tomorrow.", D + 3 * H)
    say(g, "vikram", "Noted. I'll have the API docs ready.", D + 2 * H + 40)
    say(g, "meera", "QA sign-off is pending on the auth module.", 6 * H)
    say(g, "karan", "Fixed in the latest push 👍", 5 * H + 30)
    say(g, "priya", "Great — let's ship Thursday.", 3 * H, unread_for=["aarav"], reactions=[("karan", "🎉"), ("meera", "🎉")])

    g = conv("group", ["meera", "aarav", "ananya"], admin="meera", name="Family ❤️", color="#D64545", created_days=40)
    system(g, "Meera Nair created the group", 40 * D, "meera")
    say(g, "meera", "Dinner at 8 on Saturday, everyone!", 2 * D + 2 * H)
    say(g, "ananya", "I'll bring dessert 🍰", 2 * D + H)
    say(g, "aarav", "On my way with the cake 🎂", 2 * D)
    db.commit()
