"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CircleDashed, LogOut, Mail, MessageCircle, MoreVertical, Moon, Pencil, Phone, Search, SearchX, Settings, Sun, UserRound, Users, WifiOff, X } from "lucide-react";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { listTime, previewOf } from "@/lib/format";
import type { SearchResults } from "@/lib/types";
import { ConversationItem } from "./ConversationItem";
import { Avatar, Button, ErrorState, IconButton, Spinner } from "./ui";

type Tab = "chats" | "calls" | "stories";
const TITLES: Record<Tab, string> = { chats: "Signal", calls: "Calls", stories: "Stories" };
const NOTIF_KEY = "signal.notifBanner";
const GS_KEY = "signal.getStarted";

function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="rounded bg-accent-soft px-0.5 font-semibold text-accent">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

/** "Turn on notifications?" card, shown only while the browser permission is still undecided. */
function NotificationBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser permission + dismissal flag
      if (typeof Notification !== "undefined" && Notification.permission === "default" && !localStorage.getItem(NOTIF_KEY)) setShow(true);
    } catch { /* ignore */ }
  }, []);
  if (!show) return null;
  const dismiss = () => { setShow(false); try { localStorage.setItem(NOTIF_KEY, "1"); } catch { /* ignore */ } };
  return (
    <div className="anim-pop pointer-events-auto flex w-full gap-3 rounded-2xl bg-sheet p-3.5 shadow-[var(--c-shadow)]" role="region" aria-label="Notifications">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl">👋</span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium">Turn on notifications?</p>
        <p className="mt-0.5 text-[13.5px] leading-snug text-muted">Never miss a message from your contacts and groups.</p>
        <div className="mt-2 flex justify-end gap-1">
          <button onClick={dismiss} className="rounded-full px-3 py-1.5 text-[14px] font-medium text-accent hover:bg-hover">Not now</button>
          <button onClick={() => { Notification.requestPermission().finally(dismiss); }} className="rounded-full px-3 py-1.5 text-[14px] font-medium text-accent hover:bg-hover">Turn on</button>
        </div>
      </div>
    </div>
  );
}

/** Dismissible "Get started" shortcuts (new group, invite, add photo) shown above the bottom navigation. */
function GetStarted() {
  const { me, openModal, toast } = useApp();
  const [gone, setGone] = useState<string[] | null>(null);
  useEffect(() => {
    let v: string[] = [];
    try { v = JSON.parse(localStorage.getItem(GS_KEY) || "[]"); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
    setGone(v);
  }, []);
  if (!gone) return null;
  const hide = (id: string) => { const n = [...gone, id]; setGone(n); try { localStorage.setItem(GS_KEY, JSON.stringify(n)); } catch { /* ignore */ } };
  const cards = [
    { id: "group", label: "New group", icon: Users, bg: "#fbf6e8", run: () => openModal({ type: "newGroup" }) },
    { id: "invite", label: "Invite friends", icon: Mail, bg: "#eaf3e9", run: () => { navigator.clipboard?.writeText(window.location.origin); toast({ kind: "success", title: "Invite link copied", body: window.location.origin }); } },
    ...(me?.avatar_url ? [] : [{ id: "photo", label: "Add a photo", icon: UserRound, bg: "#f1eaf8", run: () => openModal({ type: "profile" }) }]),
  ].filter((c) => !gone.includes(c.id));
  if (!cards.length) return null;
  return (
    <section aria-label="Get started" className="pb-2 pt-1">
      <h2 className="px-4 pb-2 text-[15px] font-medium">Get started</h2>
      <div className="flex gap-3 overflow-x-auto px-3 pb-1">
        {cards.map(({ id, label, icon: Icon, bg, run }) => (
          <div key={id} className="relative h-[82px] w-[150px] shrink-0 rounded-[22px] text-[#26272b]" style={{ background: bg }}>
            <button onClick={run} className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-[22px] text-[14px] font-medium"><Icon size={22} />{label}</button>
            <button aria-label={`Dismiss ${label}`} onClick={() => hide(id)} className="absolute right-2.5 top-2 rounded-full p-0.5 opacity-70 hover:opacity-100"><X size={15} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

function BottomNav({ tab, setTab, unread }: { tab: Tab; setTab: (t: Tab) => void; unread: number }) {
  const items: { id: Tab; label: string; icon: typeof MessageCircle }[] = [
    { id: "chats", label: "Chats", icon: MessageCircle }, { id: "calls", label: "Calls", icon: Phone }, { id: "stories", label: "Stories", icon: CircleDashed },
  ];
  return (
    <nav className="flex border-t border-line bg-sidebar px-2 pb-2 pt-2" aria-label="Primary">
      {items.map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined} className="group flex flex-1 flex-col items-center gap-1 py-0.5">
          <span className={`relative flex h-8 w-16 items-center justify-center rounded-full transition ${tab === id ? "bg-accent-soft text-accent" : "text-muted group-hover:bg-hover"}`}>
            <Icon size={22} fill={tab === id && id === "chats" ? "currentColor" : "none"} />
            {id === "chats" && unread > 0 && <span className="absolute right-2 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-outb px-1 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
          </span>
          <span className={`text-[12px] ${tab === id ? "font-medium text-fg" : "text-muted"}`}>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const { me, conversations, convsLoading, convsError, refreshConversations, activeId, openConversation, openModal, signOut, setTheme, wsStatus, startDirect, isOnline } = useApp();
  const [tab, setTab] = useState<Tab>("chats");
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [menu, setMenu] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "groups">("all");
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const openSearch = () => { setTab("chats"); setSearchOpen(true); };
  const closeSearch = () => { setSearchOpen(false); setQ(""); };

  useEffect(() => { // Ctrl/Cmd+K opens search
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const t = q.trim();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- debounced async search: state mirrors the query
    if (!t) { setResults(null); setSearching(false); return; }
    setSearching(true);
    const h = setTimeout(() => {
      api.search(t).then((r) => setResults(r)).catch(() => setResults({ conversations: [], contacts: [], messages: [] })).finally(() => setSearching(false));
    }, 200);
    return () => clearTimeout(h);
  }, [q]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const isDark = typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
  const open = (id: number) => { closeSearch(); openConversation(id); };
  const visible = conversations.filter((c) => filter === "all" || (filter === "unread" ? c.unread_count > 0 : c.type === "group"));
  const unreadTotal = conversations.filter((c) => c.unread_count > 0).length;
  const noResults = results && !results.conversations.length && !results.contacts.length && !results.messages.length;
  const searchingNow = searchOpen && !!q.trim();

  return (
    <aside className="relative flex h-full w-full flex-col border-r border-line bg-sidebar md:w-[360px] lg:w-[400px]" aria-label="Conversations">
      <div className="flex h-[60px] items-center gap-2 px-3 pt-1">
        {searchOpen ? (
          <div className="relative min-w-0 flex-1">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input ref={searchRef} autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search conversations"
              onKeyDown={(e) => { if (e.key === "Escape") closeSearch(); }}
              className="h-11 w-full rounded-full bg-field pl-11 pr-11 text-[16px] outline-none ring-accent placeholder:text-muted focus:ring-2" />
            <button aria-label="Close search" onClick={closeSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"><X size={20} /></button>
          </div>
        ) : (<>
          <button aria-label="Your profile" onClick={() => openModal({ type: "profile" })} className="rounded-full transition hover:opacity-80">
            {me && <Avatar name={me.display_name} color={me.avatar_color} url={me.avatar_url} size={36} />}
          </button>
          <h1 className="min-w-0 flex-1 truncate pl-1 text-[22px] font-medium">{TITLES[tab]}</h1>
          {tab === "chats" && <IconButton label="Search" onClick={openSearch}><Search size={22} /></IconButton>}
          <div className="relative" ref={menuRef}>
            <IconButton label="Menu" onClick={() => setMenu((v) => !v)} active={menu}><MoreVertical size={22} /></IconButton>
            {menu && (
              <div className="anim-pop absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-2xl bg-sheet py-1.5 shadow-[var(--c-shadow)]" role="menu">
                {[
                  { icon: UserRound, label: "Profile", run: () => openModal({ type: "profile" }) },
                  { icon: Users, label: "New group", run: () => openModal({ type: "newGroup" }) },
                  { icon: Settings, label: "Settings", run: () => openModal({ type: "settings" }) },
                  { icon: isDark ? Sun : Moon, label: isDark ? "Light mode" : "Dark mode", run: () => setTheme(isDark ? "light" : "dark") },
                  { icon: LogOut, label: "Log out", run: () => signOut(), danger: true },
                ].map((it) => (
                  <button key={it.label} role="menuitem" onClick={() => { setMenu(false); it.run(); }}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-[15px] hover:bg-hover ${it.danger ? "text-danger" : ""}`}>
                    <it.icon size={19} className={it.danger ? "" : "text-muted"} /> {it.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>)}
      </div>

      {tab === "chats" && conversations.length > 0 && !searchingNow && (
        <div className="flex gap-2 px-3 pb-2 pt-1" role="tablist" aria-label="Filter chats">
          {([["all", "All"], ["unread", unreadTotal ? `Unread · ${unreadTotal}` : "Unread"], ["groups", "Groups"]] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
              className={`rounded-lg px-3.5 py-1.5 text-[14px] font-medium transition ${filter === k ? "bg-accent-soft text-accent" : "bg-field text-muted hover:bg-hover"}`}>{label}</button>))}
        </div>
      )}

      {wsStatus !== "open" && (
        <div className="mx-3 mb-1 flex items-center gap-2 rounded-lg bg-[color-mix(in_srgb,#f29d38_18%,transparent)] px-3 py-1.5 text-xs font-medium text-[#b8741a]" role="status">
          <WifiOff size={14} /> {wsStatus === "connecting" ? "Connecting…" : "Disconnected — retrying…"}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-28">
        {tab === "calls" ? (
          <div className="flex flex-col items-center gap-3 px-8 py-20 text-center text-muted">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent"><Phone size={28} /></span>
            <p className="text-[16px] font-medium text-fg">No recent calls</p><p className="text-sm">Voice and video calls are placeholders in this demo.</p>
            <Button variant="tonal" onClick={() => openModal({ type: "comingSoon", feature: "Calls" })}>Start a call</Button>
          </div>
        ) : tab === "stories" ? (
          <div className="flex flex-col items-center gap-3 px-8 py-20 text-center text-muted">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent"><CircleDashed size={28} /></span>
            <p className="text-[16px] font-medium text-fg">No recent stories</p><p className="text-sm">Stories are a placeholder in this demo.</p>
            <Button variant="tonal" onClick={() => openModal({ type: "comingSoon", feature: "Stories" })}>Add a story</Button>
          </div>
        ) : searchingNow ? (
          searching && !results ? <div className="flex justify-center py-10"><Spinner /></div> : noResults ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-muted">
              <SearchX size={36} /><p className="font-medium text-fg">No results for &ldquo;{q.trim()}&rdquo;</p>
              <p className="text-sm">Check the spelling or try a different search.</p>
              <Button variant="tonal2" onClick={() => openModal({ type: "newChat" })} className="mt-2">Find someone new</Button>
            </div>
          ) : results && (
            <div className="space-y-3 pt-1">
              {results.conversations.length > 0 && <section><h3 className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted">Chats</h3>
                {results.conversations.map((c) => <ConversationItem key={c.id} conv={conversations.find((x) => x.id === c.id) ?? c} selected={c.id === activeId} onClick={() => open(c.id)} />)}</section>}
              {results.contacts.length > 0 && <section><h3 className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted">Contacts</h3>
                {results.contacts.map((u) => (
                  <button key={u.id} onClick={() => { closeSearch(); startDirect(u.id); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left hover:bg-hover">
                    <Avatar name={u.display_name} color={u.avatar_color} url={u.avatar_url} size={44} online={isOnline(u)} />
                    <div className="min-w-0"><p className="truncate text-[15px] font-medium"><Highlight text={u.display_name} q={q.trim()} /></p>
                      <p className="truncate text-xs text-muted">{u.phone ?? `@${u.username}`}</p></div>
                  </button>))}</section>}
              {results.messages.length > 0 && <section><h3 className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted">Messages</h3>
                {results.messages.map((r) => (
                  <button key={r.message.id} onClick={() => open(r.conversation_id)} className="block w-full rounded-2xl px-3 py-2 text-left hover:bg-hover">
                    <div className="flex items-baseline justify-between gap-2"><span className="truncate text-[15px] font-medium">{r.conversation_title}</span>
                      <span className="shrink-0 text-xs text-muted">{listTime(r.message.created_at)}</span></div>
                    <p className="line-clamp-2 text-[13.5px] text-muted"><Highlight text={previewOf(r.message)} q={q.trim()} /></p>
                  </button>))}</section>}
            </div>
          )
        ) : convsLoading && conversations.length === 0 ? (
          <div className="space-y-1 pt-1" aria-label="Loading conversations">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="skeleton h-[52px] w-[52px] rounded-full" />
                <div className="flex-1 space-y-2"><div className="skeleton h-3.5 w-1/2 rounded" /><div className="skeleton h-3 w-4/5 rounded" /></div>
              </div>))}
          </div>
        ) : convsError && conversations.length === 0 ? (
          <ErrorState message={convsError} onRetry={refreshConversations} />
        ) : conversations.length > 0 && visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-8 py-14 text-center text-muted">
            <MessageCircle size={32} /><p className="font-medium text-fg">{filter === "unread" ? "You're all caught up" : "No groups yet"}</p>
            <p className="text-sm">{filter === "unread" ? "No unread conversations." : "Create a group to chat with several people at once."}</p>
            <Button variant="tonal2" onClick={() => (filter === "groups" ? openModal({ type: "newGroup" }) : setFilter("all"))}>{filter === "groups" ? "New group" : "Show all chats"}</Button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-8 pt-16 text-center">
            <p className="text-[15px] font-medium">No chats yet.</p>
            <p className="text-[15px] text-muted">Get started by messaging a friend.</p>
          </div>
        ) : (
          <div className="space-y-0.5 pt-1">
            {visible.map((c) => <ConversationItem key={c.id} conv={c} selected={c.id === activeId} onClick={() => open(c.id)} />)}
          </div>
        )}
      </div>

      {tab === "chats" && !searchOpen && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex flex-col items-end gap-3 px-4">
          <button aria-label="Camera" onClick={() => openModal({ type: "comingSoon", feature: "Camera" })}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-[14px] bg-btn2 text-btn2-fg shadow-[var(--c-shadow)] transition hover:brightness-110"><Camera size={20} /></button>
          <button aria-label="New message (Alt+N)" onClick={() => openModal({ type: "newChat" })}
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-btn text-btn-fg shadow-[var(--c-shadow)] transition hover:brightness-110 active:scale-95"><Pencil size={22} /></button>
          <NotificationBanner />
        </div>
      )}
      </div>

      {tab === "chats" && !searchOpen && <GetStarted />}

      <BottomNav tab={tab} setTab={(t) => { setTab(t); closeSearch(); }} unread={unreadTotal} />
    </aside>
  );
}
