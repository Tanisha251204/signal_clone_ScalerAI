"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, Clock, Info, Lock, MoreVertical, Phone, Timer, Video } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { dayLabel, lastSeen, timerLabel } from "@/lib/format";
import type { Message } from "@/lib/types";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import { Avatar, ErrorState, IconButton, Spinner, TypingDots } from "./ui";

const GAP_MS = 5 * 60 * 1000;

export function ChatView() {
  const { active: conv, messages, hasMore, messagesLoading, messagesError, loadOlder, openConversation, closeConversation, unreadMarker, me, typingNames, isOnline, lastSeenOf, openModal, wsStatus } = useApp();
  const [reply, setReply] = useState<Message | null>(null);
  const [menu, setMenu] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [focusSignal, setFocusSignal] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const prevHeight = useRef<number | null>(null);
  const prevLen = useRef(0);
  const lastId = useRef<number | null>(null);
  const loadingOlder = useRef(false);
  const cid = conv?.id ?? 0;
  const list = useMemo(() => messages[cid] ?? [], [messages, cid]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scroller.current; if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // initial positioning, new-message follow, and prepend-preservation
  useLayoutEffect(() => {
    const el = scroller.current; if (!el || !conv) return;
    if (prevHeight.current !== null) { // older messages were prepended
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null; loadingOlder.current = false; prevLen.current = list.length;
      return;
    }
    const newest = list[list.length - 1];
    if (prevLen.current === 0 && list.length) {
      const marker = unreadMarker?.convId === cid ? el.querySelector(`[data-msg-id="${unreadMarker.messageId}"]`) : null;
      if (marker) (marker as HTMLElement).scrollIntoView({ block: "center" }); else scrollToBottom();
    } else if (newest && newest.id !== lastId.current && list.length > prevLen.current) {
      const mine = newest.sender_id === me?.id;
      if (mine || atBottom) scrollToBottom(true);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- count of messages that arrived while scrolled up
      else setNewCount((n) => n + (newest.kind === "text" ? 1 : 0));
    }
    prevLen.current = list.length;
    lastId.current = newest?.id ?? null;
  }, [list, cid]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = scroller.current; if (!el || !conv) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setAtBottom(near);
    if (near) setNewCount(0);
    if (el.scrollTop < 100 && hasMore[cid] && !loadingOlder.current && !messagesLoading) {
      loadingOlder.current = true;
      prevHeight.current = el.scrollHeight;
      loadOlder(cid).finally(() => setTimeout(() => { prevHeight.current = null; loadingOlder.current = false; }, 400)); // safety net if nothing was prepended
    }
  };

  const jumpTo = (id: number) => {
    const node = scroller.current?.querySelector(`[data-msg-id="${id}"]`) as HTMLElement | null;
    if (!node) return;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    node.animate([{ background: "var(--c-accent-soft)" }, { background: "transparent" }], { duration: 1400 });
  };

  if (!conv) return null;

  const typers = typingNames(conv.id);
  let subtitle: React.ReactNode;
  if (typers.length) subtitle = <span className="flex items-center gap-1.5 text-accent"><TypingDots />{conv.type === "group" ? `${typers.join(", ")} ${typers.length > 1 ? "are" : "is"} typing` : "typing"}</span>;
  else if (conv.type === "direct" && conv.peer) subtitle = isOnline(conv.peer) ? <span className="text-[#2e9a57]">Online</span> : lastSeen(lastSeenOf(conv.peer));
  else subtitle = `${conv.members.length} members`;

  const items: React.ReactNode[] = [];
  list.forEach((m, i) => {
    const prev = list[i - 1], next = list[i + 1];
    const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
    if (newDay) items.push(<div key={`d${m.id}`} className="sticky top-1 z-10 my-3 flex justify-center"><span className="rounded-full bg-field/95 px-3 py-1 text-xs font-medium text-muted backdrop-blur">{dayLabel(m.created_at)}</span></div>);
    if (unreadMarker?.convId === cid && unreadMarker.messageId === m.id)
      items.push(<div key="unread" className="my-3 flex items-center gap-3 text-xs font-semibold text-accent"><span className="h-px flex-1 bg-accent/30" />Unread messages<span className="h-px flex-1 bg-accent/30" /></div>);
    const joins = (a?: Message, b?: Message) => !!a && !!b && a.kind === "text" && b.kind === "text" && a.sender_id === b.sender_id && Math.abs(+new Date(b.created_at) - +new Date(a.created_at)) < GAP_MS && new Date(a.created_at).toDateString() === new Date(b.created_at).toDateString();
    items.push(<MessageBubble key={m.client_id ? `c${m.sender_id}:${m.client_id}` : m.id} msg={m} conv={conv} first={!joins(prev, m)} last={!joins(m, next)} onReply={(x) => { setReply(x); setFocusSignal((n) => n + 1); }} onJumpTo={jumpTo} />);
  });

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-chat" aria-label={`Chat with ${conv.title}`}>
      <header className="flex items-center gap-2 border-b border-line bg-chat px-2 py-2.5 md:px-4">
        <IconButton label="Back to chats" onClick={closeConversation} className="md:hidden"><ArrowLeft size={22} /></IconButton>
        <button onClick={() => openModal({ type: "info", conversationId: conv.id })} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-0.5 text-left transition hover:opacity-80" aria-label="Conversation details">
          <Avatar name={conv.title} color={conv.type === "direct" ? conv.peer?.avatar_color ?? conv.avatar_color : conv.avatar_color} url={conv.peer?.avatar_url}
            online={conv.peer ? isOnline(conv.peer) : false} size={42} />
          <div className="min-w-0">
            <h1 className="flex items-center gap-1.5 truncate text-base font-semibold" data-testid="chat-title">{conv.title}
              {conv.disappear_after && <span title={`Disappearing messages: ${timerLabel(conv.disappear_after)}`} className="text-muted"><Timer size={14} /></span>}</h1>
            <p className="truncate text-[13px] text-muted">{subtitle}</p>
          </div>
        </button>
        <IconButton label="Video call" onClick={() => openModal({ type: "comingSoon", feature: "Video calls" })} className="hidden sm:flex"><Video size={20} /></IconButton>
        <IconButton label="Voice call" onClick={() => openModal({ type: "comingSoon", feature: "Voice calls" })} className="hidden sm:flex"><Phone size={19} /></IconButton>
        <div className="relative">
          <IconButton label="Conversation menu" onClick={() => setMenu((v) => !v)} active={menu}><MoreVertical size={20} /></IconButton>
          {menu && (<>
            <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} />
            <div className="anim-pop absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-2xl border border-line bg-bg py-1.5 shadow-[var(--c-shadow)]" role="menu">
              <button role="menuitem" onClick={() => { setMenu(false); openModal({ type: "info", conversationId: conv.id }); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-hover"><Info size={17} className="text-muted" /> {conv.type === "group" ? "Group info" : "Contact info"}</button>
              <button role="menuitem" onClick={() => { setMenu(false); openModal({ type: "info", conversationId: conv.id }); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-hover"><Clock size={17} className="text-muted" /> Disappearing messages</button>
              <button role="menuitem" onClick={() => { setMenu(false); openModal({ type: "comingSoon", feature: "Video calls" }); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-hover sm:hidden"><Video size={17} className="text-muted" /> Video call</button>
              <button role="menuitem" onClick={() => { setMenu(false); closeConversation(); }} className="hidden w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-hover md:flex"><ArrowLeft size={17} className="text-muted" /> Close chat</button>
            </div>
          </>)}
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={scroller} onScroll={onScroll} className="chat-pattern h-full overflow-y-auto px-3 py-3 md:px-6" data-testid="message-list">
          {messagesLoading && list.length === 0 ? (
            <div className="space-y-3 pt-4" aria-label="Loading messages">
              {[60, 40, 70, 30, 55].map((w, i) => <div key={i} className={`flex ${i % 2 ? "justify-end" : ""}`}><div className="skeleton h-10 rounded-2xl" style={{ width: `${w}%` }} /></div>)}
            </div>
          ) : messagesError && list.length === 0 ? (
            <ErrorState message={messagesError} onRetry={() => openConversation(conv.id)} />
          ) : (<>
            {hasMore[cid] && <div className="flex justify-center py-2"><Spinner size={18} /></div>}
            {!hasMore[cid] && (
              <div className="mx-auto my-4 flex max-w-xs flex-col items-center gap-2 text-center">
                <Avatar name={conv.title} color={conv.type === "direct" ? conv.peer?.avatar_color ?? conv.avatar_color : conv.avatar_color} url={conv.peer?.avatar_url} size={72} />
                <p className="text-lg font-semibold">{conv.title}</p>
                {conv.type === "direct" && conv.peer && <p className="text-sm text-muted">{conv.peer.about}</p>}
                <p className="mt-1 flex items-center gap-1.5 rounded-full bg-field px-3 py-1 text-xs text-muted"><Lock size={12} /> Messages are end-to-end encrypted (simulated)</p>
              </div>
            )}
            {list.length === 0 && (
              <div className="flex flex-col items-center gap-1 py-10 text-center text-muted"><span className="text-4xl">👋</span><p className="font-medium text-fg">Say hello to {conv.title.split(" ")[0]}</p><p className="text-sm">No messages yet. Your conversation will appear here.</p></div>
            )}
            {items}
            {typers.length > 0 && (
              <div className="mb-2 flex"><div className="anim-pop rounded-[20px] bg-inb px-4 py-3 text-muted"><TypingDots /></div></div>
            )}
          </>)}
        </div>
        {!atBottom && (
          <button aria-label="Scroll to latest" onClick={() => { scrollToBottom(true); setNewCount(0); }}
            className="anim-pop absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-bg text-fg shadow-[var(--c-shadow)]">
            <ArrowDown size={18} />
            {newCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-outb px-1 text-[11px] font-bold text-white">{newCount}</span>}
          </button>
        )}
      </div>
      {wsStatus !== "open" && <div className="bg-[color-mix(in_srgb,#f29d38_18%,transparent)] px-4 py-1 text-center text-xs font-medium text-[#b8741a]" role="status">Reconnecting… live updates are paused</div>}
      <Composer key={conv.id} conv={conv} replyTo={reply} onClearReply={() => setReply(null)} focusSignal={focusSignal} />
    </section>
  );
}
