"use client";

import { useEffect, useRef, useState } from "react";
import { CircleDashed, LogOut, MessageSquarePlus, MoreVertical, Moon, Search, Settings, Sun, UserRound, Users, X, SearchX, MessageCircle, WifiOff } from "lucide-react";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { listTime, previewOf } from "@/lib/format";
import type { SearchResults } from "@/lib/types";
import { ConversationItem } from "./ConversationItem";
import { Avatar, Button, ErrorState, IconButton, Spinner } from "./ui";

function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="rounded bg-accent-soft px-0.5 font-semibold text-accent">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

export function Sidebar({ searchRef }: { searchRef: React.RefObject<HTMLInputElement | null> }) {
  const { me, conversations, convsLoading, convsError, refreshConversations, activeId, openConversation, openModal, signOut, setTheme, wsStatus, startDirect, isOnline } = useApp();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [menu, setMenu] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "groups">("all");
  const menuRef = useRef<HTMLDivElement>(null);

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
  const open = (id: number) => { setQ(""); openConversation(id); };
  const visible = conversations.filter((c) => filter === "all" || (filter === "unread" ? c.unread_count > 0 : c.type === "group"));
  const unreadTotal = conversations.filter((c) => c.unread_count > 0).length;
  const noResults = results && !results.conversations.length && !results.contacts.length && !results.messages.length;

  return (
    <aside className="flex h-full w-full flex-col border-r border-line bg-sidebar md:w-[360px] lg:w-[400px]" aria-label="Conversations">
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <button aria-label="Your profile" onClick={() => openModal({ type: "profile" })} className="rounded-full transition hover:opacity-80">
          {me && <Avatar name={me.display_name} color={me.avatar_color} url={me.avatar_url} size={38} />}
        </button>
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search conversations"
            onKeyDown={(e) => { if (e.key === "Escape") { setQ(""); (e.target as HTMLInputElement).blur(); } }}
            className="h-9 w-full rounded-full bg-field pl-9 pr-8 text-sm outline-none ring-accent placeholder:text-muted focus:ring-2" />
          {q && <button aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-fg"><X size={16} /></button>}
        </div>
        <IconButton label="New message (Alt+N)" onClick={() => openModal({ type: "newChat" })}><MessageSquarePlus size={20} /></IconButton>
        <div className="relative" ref={menuRef}>
          <IconButton label="Menu" onClick={() => setMenu((v) => !v)} active={menu}><MoreVertical size={20} /></IconButton>
          {menu && (
            <div className="anim-pop absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-2xl border border-line bg-bg py-1.5 shadow-[var(--c-shadow)]" role="menu">
              {[
                { icon: UserRound, label: "Profile", run: () => openModal({ type: "profile" }) },
                { icon: Users, label: "New group", run: () => openModal({ type: "newGroup" }) },
                { icon: CircleDashed, label: "Stories", run: () => openModal({ type: "comingSoon", feature: "Stories" }) },
                { icon: Settings, label: "Settings", run: () => openModal({ type: "settings" }) },
                { icon: isDark ? Sun : Moon, label: isDark ? "Light mode" : "Dark mode", run: () => setTheme(isDark ? "light" : "dark") },
                { icon: LogOut, label: "Log out", run: () => signOut(), danger: true },
              ].map((it) => (
                <button key={it.label} role="menuitem" onClick={() => { setMenu(false); it.run(); }}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-hover ${it.danger ? "text-danger" : ""}`}>
                  <it.icon size={18} className={it.danger ? "" : "text-muted"} /> {it.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 px-3 pb-2" role="tablist" aria-label="Filter chats">
        {([["all", "All"], ["unread", unreadTotal ? `Unread · ${unreadTotal}` : "Unread"], ["groups", "Groups"]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1 text-[13px] font-medium transition ${filter === k ? "bg-accent-soft text-accent" : "text-muted hover:bg-hover"}`}>{label}</button>))}
      </div>

      {wsStatus !== "open" && (
        <div className="mx-3 mb-1 flex items-center gap-2 rounded-lg bg-[color-mix(in_srgb,#f29d38_18%,transparent)] px-3 py-1.5 text-xs font-medium text-[#b8741a]" role="status">
          <WifiOff size={14} /> {wsStatus === "connecting" ? "Connecting…" : "Disconnected — retrying…"}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {q.trim() ? (
          searching && !results ? <div className="flex justify-center py-10"><Spinner /></div> : noResults ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-muted">
              <SearchX size={36} /><p className="font-medium text-fg">No results for &ldquo;{q.trim()}&rdquo;</p>
              <p className="text-sm">Check the spelling or try a different search.</p>
              <Button variant="ghost" onClick={() => openModal({ type: "newChat" })} className="mt-2">Find someone new</Button>
            </div>
          ) : results && (
            <div className="space-y-3 pt-1">
              {results.conversations.length > 0 && <section><h3 className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">Chats</h3>
                {results.conversations.map((c) => <ConversationItem key={c.id} conv={conversations.find((x) => x.id === c.id) ?? c} selected={c.id === activeId} onClick={() => open(c.id)} />)}</section>}
              {results.contacts.length > 0 && <section><h3 className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">Contacts</h3>
                {results.contacts.map((u) => (
                  <button key={u.id} onClick={() => { setQ(""); startDirect(u.id); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-hover">
                    <Avatar name={u.display_name} color={u.avatar_color} url={u.avatar_url} size={40} online={isOnline(u)} />
                    <div className="min-w-0"><p className="truncate text-sm font-semibold"><Highlight text={u.display_name} q={q.trim()} /></p>
                      <p className="truncate text-xs text-muted">{u.phone ?? `@${u.username}`}</p></div>
                  </button>))}</section>}
              {results.messages.length > 0 && <section><h3 className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">Messages</h3>
                {results.messages.map((r) => (
                  <button key={r.message.id} onClick={() => open(r.conversation_id)} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-hover">
                    <div className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-semibold">{r.conversation_title}</span>
                      <span className="shrink-0 text-xs text-muted">{listTime(r.message.created_at)}</span></div>
                    <p className="line-clamp-2 text-[13px] text-muted"><Highlight text={previewOf(r.message)} q={q.trim()} /></p>
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
            <Button variant="ghost" onClick={() => (filter === "groups" ? openModal({ type: "newGroup" }) : setFilter("all"))}>{filter === "groups" ? "New group" : "Show all chats"}</Button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent"><MessageCircle size={30} /></div>
            <p className="text-base font-semibold">No chats yet</p>
            <p className="text-sm text-muted">Start a conversation with a contact or create a group to get going.</p>
            <Button onClick={() => openModal({ type: "newChat" })}>New message</Button>
          </div>
        ) : (
          <div className="space-y-0.5 pt-1">
            {visible.map((c) => <ConversationItem key={c.id} conv={c} selected={c.id === activeId} onClick={() => open(c.id)} />)}
          </div>
        )}
      </div>
    </aside>
  );
}
