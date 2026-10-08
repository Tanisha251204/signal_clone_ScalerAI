"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, LogOut, Mail, MessageCircle, MoreVertical, Moon, Palette, Pencil, Phone, Search, SearchX, Settings, Sun, UserRound, Users, WifiOff, X } from "lucide-react";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { listTime, previewOf } from "@/lib/format";
import type { SearchResults } from "@/lib/types";
import { DEMO_STORIES, loadSeen, saveSeen, type Story } from "@/lib/stories";
import { ConversationItem } from "./ConversationItem";
import { Avatar, Button, ErrorState, IconButton, Spinner } from "./ui";

type Tab = "chats" | "calls" | "stories";

/** Stacked-cards icon used for Stories: a front card with a second card peeking out behind it (top-left). */
function StoriesIcon({ size = 22, fill = "none", className }: { size?: number; fill?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="8" y="7" width="12.5" height="14.5" rx="3" fill={fill} />
      <path d="M16.5 3.5H7.2A3.2 3.2 0 0 0 4 6.7v9.1" />
    </svg>
  );
}
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

/** Dismissible "Get started" shortcuts (new group, invite, add photo, chat color) shown above the bottom navigation. */
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
    { id: "color", label: "Chat color", icon: Palette, bg: "#e4eff2", run: () => openModal({ type: "comingSoon", feature: "Chat colors" }) },
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

function BottomNav({ tab, setTab, unread, stories }: { tab: Tab; setTab: (t: Tab) => void; unread: number; stories: number }) {
  const items: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; fill?: string; className?: string }>; badge: number; badgeClass: string }[] = [
    { id: "chats", label: "Chats", icon: MessageCircle, badge: unread, badgeClass: "bg-outb" },
    { id: "calls", label: "Calls", icon: Phone, badge: 0, badgeClass: "" },
    { id: "stories", label: "Stories", icon: StoriesIcon, badge: stories, badgeClass: "bg-[#e5484d]" },
  ];
  return (
    <nav className="flex border-t border-line bg-sidebar px-2 pb-2 pt-1.5" aria-label="Primary">
      {items.map(({ id, label, icon: Icon, badge, badgeClass }) => {
        const on = tab === id;
        return (
          <button key={id} onClick={() => setTab(id)} aria-current={on ? "page" : undefined} className="flex flex-1 flex-col items-center gap-0.5 py-1">
            <span className={`relative flex h-8 w-14 items-center justify-center ${on ? "text-fg" : "text-muted"}`}>
              <Icon size={26} fill={on ? "currentColor" : "none"} />
              {badge > 0 && <span className={`absolute right-0.5 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none text-white ${badgeClass}`}>{badge > 99 ? "99+" : badge}</span>}
            </span>
            <span className={`text-[12px] ${on ? "font-semibold text-fg" : "text-muted"}`}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** Stories tab: "My story" + recent updates from contacts, and a tiny full-screen viewer. */
function StoriesTab({ stories, seen, open }: { stories: Story[]; seen: string[]; open: (s: Story) => void }) {
  const { me, openModal } = useApp();
  return (
    <div className="pb-4 pt-1">
      <button onClick={() => openModal({ type: "comingSoon", feature: "Stories" })} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-hover">
        {me && <Avatar name={me.display_name} color={me.avatar_color} url={me.avatar_url} size={52} />}
        <div><p className="text-[16px] font-medium">My story</p><p className="text-[14px] text-muted">Tap to add a story</p></div>
      </button>
      <h3 className="px-4 pb-1 pt-4 text-[14px] font-medium text-muted">Recent updates</h3>
      {stories.length === 0 && <p className="px-4 py-3 text-sm text-muted">No recent stories</p>}
      {stories.map((st) => (
        <button key={st.id} onClick={() => open(st)} aria-label={`Story from ${st.author}`} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-hover">
          <span className={`rounded-full p-[3px] ${seen.includes(st.id) ? "ring-2 ring-line" : "ring-2 ring-accent"}`}><Avatar name={st.author} color={st.color} size={46} /></span>
          <div><p className="text-[16px] font-medium">{st.author}</p><p className="text-[14px] text-muted">{st.ago}</p></div>
        </button>
      ))}
    </div>
  );
}

function StoryViewer({ story, onClose }: { story: Story; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={`Story from ${story.author}`} onClick={onClose} className="anim-fade fixed inset-0 z-[60] flex flex-col text-white" style={{ background: story.bg }}>
      <div className="mx-3 mt-3 h-1 overflow-hidden rounded-full bg-white/30"><div className="h-full origin-left bg-white" style={{ animation: "story-progress 5s linear forwards" }} /></div>
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar name={story.author} color={story.color} size={38} />
        <div className="flex-1"><p className="text-[15px] font-medium">{story.author}</p><p className="text-[12px] opacity-80">{story.ago}</p></div>
        <button aria-label="Close story" onClick={(e) => { e.stopPropagation(); onClose(); }} className="rounded-full p-2 hover:bg-white/15"><X size={22} /></button>
      </div>
      <div className="flex flex-1 items-center justify-center px-8 text-center"><p className="whitespace-pre-line text-[28px] font-semibold leading-snug">{story.text}</p></div>
    </div>
  );
}

export function Sidebar() {
  const { me, conversations, convsLoading, convsError, refreshConversations, activeId, openConversation, openModal, signOut, setTheme, wsStatus, startDirect, isOnline } = useApp();
  const [tab, setTab] = useState<Tab>("chats");
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  const [viewing, setViewing] = useState<Story | null>(null);
  useEffect(() => { // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
    setSeen(loadSeen());
    const openFromElsewhere = () => { setTab("chats"); setSearchOpen(true); }; // chat menu / chat settings → "Search"
    window.addEventListener("signal:open-search", openFromElsewhere);
    return () => window.removeEventListener("signal:open-search", openFromElsewhere);
  }, []);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [menu, setMenu] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "groups">("all");
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const stories = DEMO_STORIES.filter((st) => st.author !== me?.display_name);
  const unseenStories = stories.filter((st) => !seen.includes(st.id)).length;
  const viewStory = (st: Story) => { setViewing(st); if (!seen.includes(st.id)) { const n = [...seen, st.id]; setSeen(n); saveSeen(n); } };
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
          <StoriesTab stories={stories} seen={seen} open={viewStory} />
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

      <BottomNav tab={tab} setTab={(t) => { setTab(t); closeSearch(); }} unread={unreadTotal} stories={unseenStories} />
      {viewing && <StoryViewer story={viewing} onClose={() => setViewing(null)} />}
    </aside>
  );
}
