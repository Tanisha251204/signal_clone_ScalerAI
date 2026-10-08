"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError, setToken, setUnauthorizedHandler } from "@/lib/api";
import { PREFS_KEY, THEME_KEY, TOKEN_KEY, WS_URL } from "@/lib/config";
import { previewOf } from "@/lib/format";
import type { Attachment, Conversation, Message, MsgStatus, ThemePref, Toast, User } from "@/lib/types";

export type ModalState =
  | { type: "newChat" }
  | { type: "newGroup" }
  | { type: "profile" }
  | { type: "settings" }
  | { type: "info"; conversationId: number }
  | { type: "connections" }
  | { type: "comingSoon"; feature: string }
  | null;

export interface Prefs { notifications: boolean; typingIndicators: boolean; enterToSend: boolean; readReceipts: boolean; screenLock: boolean; relayCalls: boolean }
const DEFAULT_PREFS: Prefs = { notifications: true, typingIndicators: true, enterToSend: true, readReceipts: true, screenLock: false, relayCalls: false };

interface Ctx {
  booting: boolean;
  token: string | null;
  me: User | null;
  setMe: (u: User) => void;
  signIn: (token: string, user: User) => void;
  signOut: () => Promise<void>;
  conversations: Conversation[];
  convsLoading: boolean;
  convsError: string | null;
  refreshConversations: () => Promise<void>;
  activeId: number | null;
  active: Conversation | null;
  openConversation: (id: number) => Promise<void>;
  closeConversation: () => void;
  messages: Record<number, Message[]>;
  hasMore: Record<number, boolean>;
  messagesLoading: boolean;
  messagesError: string | null;
  loadOlder: (id: number) => Promise<void>;
  unreadMarker: { convId: number; messageId: number } | null;
  sendMessage: (cid: number, input: { body: string; replyTo?: Message | null; attachment?: Attachment | null }) => Promise<void>;
  retryMessage: (m: Message) => Promise<void>;
  react: (m: Message, emoji: string) => Promise<void>;
  deleteMessage: (m: Message) => Promise<void>;
  sendTyping: (cid: number, isTyping: boolean) => void;
  typingNames: (cid: number) => string[];
  isOnline: (u: User) => boolean;
  lastSeenOf: (u: User) => string | null;
  startDirect: (userId: number) => Promise<void>;
  createGroup: (name: string, memberIds: number[]) => Promise<void>;
  upsertConversation: (c: Conversation) => void;
  wsStatus: "connecting" | "open" | "closed";
  toasts: Toast[];
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  prefs: Prefs;
  setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void;
  modal: ModalState;
  openModal: (m: ModalState) => void;
  closeModal: () => void;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
};

const RANK: Record<string, number> = { failed: -1, sending: 0, sent: 1, delivered: 2, read: 3 };
const best = (a: MsgStatus | null, b: MsgStatus | null): MsgStatus | null => ((RANK[a ?? ""] ?? -2) >= (RANK[b ?? ""] ?? -2) ? a : b);
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong");

export function AppProvider({ children }: { children: ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [token, setTokenState] = useState<string | null>(null);
  const [me, setMeState] = useState<User | null>(null);
  const [convs, setConvs] = useState<Record<number, Conversation>>({});
  const [convsLoading, setConvsLoading] = useState(true); // true until the first list load finishes: never flash the empty state
  const [convsError, setConvsError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<number, Message[]>>({});
  const [hasMore, setHasMore] = useState<Record<number, boolean>>({});
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [unreadMarker, setUnreadMarker] = useState<Ctx["unreadMarker"]>(null);
  const [typing, setTyping] = useState<Record<number, Record<number, { name: string; at: number }>>>({});
  const [presence, setPresence] = useState<Record<number, { online: boolean; last_seen_at: string | null }>>({});
  const [wsStatus, setWsStatus] = useState<Ctx["wsStatus"]>("closed");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [theme, setThemeState] = useState<ThemePref>("system");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [modal, setModal] = useState<ModalState>(null);

  // Latest-value refs so websocket handlers never see stale state.
  const R = useRef({ me, convs, messages, activeId, prefs });
  R.current = { me, convs, messages, activeId, prefs };
  const wsRef = useRef<WebSocket | null>(null);
  const toastId = useRef(1);
  const typingSent = useRef<Record<number, boolean>>({});

  // ───── toasts ─────
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = toastId.current++;
    setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
    setTimeout(() => dismissToast(id), t.kind === "error" ? 6000 : 4500);
  }, [dismissToast]);

  // ───── theme + prefs (persisted) ─────
  useEffect(() => {
    try {
      const t = localStorage.getItem(THEME_KEY) as ThemePref | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
      if (t) setThemeState(t);
      const p = localStorage.getItem(PREFS_KEY);
      if (p) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(p) });
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.theme = theme === "system" ? (mq.matches ? "dark" : "light") : theme; };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  const setTheme = useCallback((t: ThemePref) => { setThemeState(t); try { localStorage.setItem(THEME_KEY, t); } catch { /* */ } }, []);
  const setPref = useCallback(<K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    setPrefs((p) => { const n = { ...p, [k]: v }; try { localStorage.setItem(PREFS_KEY, JSON.stringify(n)); } catch { /* */ } return n; });
  }, []);

  // ───── conversation helpers ─────
  const upsertConversation = useCallback((c: Conversation) => setConvs((p) => ({ ...p, [c.id]: c })), []);
  const patchConv = useCallback((id: number, fn: (c: Conversation) => Conversation) =>
    setConvs((p) => (p[id] ? { ...p, [id]: fn(p[id]) } : p)), []);

  const refreshConversations = useCallback(async () => {
    try {
      const list = await api.conversations();
      setConvs(Object.fromEntries(list.map((c) => [c.id, c])));
      setConvsError(null);
    } catch (e) { setConvsError(errMsg(e)); }
  }, []);

  const upsertMessage = useCallback((m: Message) => {
    setMessages((prev) => {
      const list = prev[m.conversation_id];
      if (!list) return prev;
      const i = list.findIndex((x) => x.id === m.id || (!!m.client_id && x.client_id === m.client_id && x.sender_id === m.sender_id));
      if (i < 0) return { ...prev, [m.conversation_id]: [...list, m] };
      const next = list.slice();
      next[i] = { ...m, status: best(list[i].status === "failed" ? null : list[i].status, m.status) };
      return { ...prev, [m.conversation_id]: next };
    });
  }, []);

  const wsSend = useCallback((payload: object): boolean => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify(payload)); return true; }
    return false;
  }, []);

  const markRead = useCallback((cid: number) => {
    patchConv(cid, (c) => (c.unread_count ? { ...c, unread_count: 0 } : c));
    if (!wsSend({ type: "read", conversation_id: cid })) api.markRead(cid).catch(() => {});
  }, [patchConv, wsSend]);

  const loadMessages = useCallback(async (id: number) => {
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      const res = await api.messages(id);
      const pending = (R.current.messages[id] ?? []).filter((m) => m.id < 0);
      setMessages((p) => ({ ...p, [id]: [...res.messages, ...pending.filter((t) => !res.messages.some((m) => m.client_id && m.client_id === t.client_id))] }));
      setHasMore((p) => ({ ...p, [id]: res.has_more }));
      return res.messages;
    } catch (e) {
      setMessagesError(errMsg(e));
      return null;
    } finally { setMessagesLoading(false); }
  }, []);

  const openConversation = useCallback(async (id: number) => {
    setActiveId(id);
    setUnreadMarker(null);
    const conv = R.current.convs[id];
    const unread = conv?.unread_count ?? 0;
    let list = R.current.messages[id];
    if (!list) list = (await loadMessages(id)) ?? [];
    if (unread > 0) {
      const incoming = list.filter((m) => m.sender_id !== R.current.me?.id && m.kind === "text");
      if (incoming.length >= unread) setUnreadMarker({ convId: id, messageId: incoming[incoming.length - unread].id });
      markRead(id);
    }
  }, [loadMessages, markRead]);

  const closeConversation = useCallback(() => { setActiveId(null); setUnreadMarker(null); }, []);

  const loadOlder = useCallback(async (id: number) => {
    const first = R.current.messages[id]?.find((m) => m.id > 0);
    if (!first) return;
    try {
      const res = await api.messages(id, first.id);
      setMessages((p) => ({ ...p, [id]: [...res.messages, ...(p[id] ?? [])] }));
      setHasMore((p) => ({ ...p, [id]: res.has_more }));
    } catch (e) { toast({ kind: "error", title: "Couldn't load older messages", body: errMsg(e) }); }
  }, [toast]);

  // ───── sending ─────
  const doSend = useCallback(async (temp: Message) => {
    try {
      const saved = await api.sendMessage(temp.conversation_id, {
        body: temp.body, client_id: temp.client_id!, reply_to_id: temp.reply_to?.id ?? null,
        ...(temp.attachment ? { attachment_url: temp.attachment.url, attachment_name: temp.attachment.name, attachment_type: temp.attachment.type, attachment_size: temp.attachment.size } : {}),
      });
      upsertMessage(saved);
    } catch (e) {
      setMessages((p) => ({ ...p, [temp.conversation_id]: (p[temp.conversation_id] ?? []).map((m) => (m.client_id === temp.client_id && m.id < 0 ? { ...m, status: "failed" as MsgStatus } : m)) }));
      toast({ kind: "error", title: "Message not sent", body: errMsg(e) });
    }
  }, [toast, upsertMessage]);

  const sendMessage: Ctx["sendMessage"] = useCallback(async (cid, { body, replyTo, attachment }) => {
    const meNow = R.current.me;
    if (!meNow) return;
    const now = new Date().toISOString();
    const temp: Message = {
      id: -Math.floor(Date.now() + Math.random() * 1000), conversation_id: cid, sender_id: meNow.id,
      sender: { id: meNow.id, display_name: meNow.display_name, avatar_color: meNow.avatar_color, avatar_url: meNow.avatar_url },
      kind: "text", body, is_deleted: false, attachment: attachment ?? null, client_id: uid(), created_at: now, expires_at: null,
      status: "sending", receipts: null, reactions: [],
      reply_to: replyTo ? { id: replyTo.id, sender_id: replyTo.sender_id, sender_name: replyTo.sender?.display_name ?? "", body: replyTo.body.slice(0, 140), attachment_type: replyTo.attachment?.type ?? null, is_deleted: false } : null,
    };
    setMessages((p) => ({ ...p, [cid]: [...(p[cid] ?? []), temp] }));
    patchConv(cid, (c) => ({ ...c, last_message: temp, updated_at: now }));
    sendTypingRaw(cid, false);
    await doSend(temp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doSend, patchConv]);

  const retryMessage = useCallback(async (m: Message) => {
    setMessages((p) => ({ ...p, [m.conversation_id]: (p[m.conversation_id] ?? []).map((x) => (x.client_id === m.client_id ? { ...x, status: "sending" as MsgStatus } : x)) }));
    await doSend(m);
  }, [doSend]);

  const react = useCallback(async (m: Message, emoji: string) => {
    try { upsertMessage(await api.react(m.id, emoji)); } catch (e) { toast({ kind: "error", title: "Couldn't react", body: errMsg(e) }); }
  }, [toast, upsertMessage]);

  const deleteMessage = useCallback(async (m: Message) => {
    if (m.id < 0) { setMessages((p) => ({ ...p, [m.conversation_id]: (p[m.conversation_id] ?? []).filter((x) => x.client_id !== m.client_id) })); return; }
    try { upsertMessage(await api.deleteMessage(m.id)); toast({ kind: "success", title: "Message deleted for everyone" }); }
    catch (e) { toast({ kind: "error", title: "Couldn't delete", body: errMsg(e) }); }
  }, [toast, upsertMessage]);

  function sendTypingRaw(cid: number, isTyping: boolean) {
    if (!R.current.prefs.typingIndicators) return;
    if (typingSent.current[cid] === isTyping) return;
    typingSent.current[cid] = isTyping;
    wsSend({ type: "typing", conversation_id: cid, is_typing: isTyping });
  }
  const sendTyping = useCallback((cid: number, isTyping: boolean) => sendTypingRaw(cid, isTyping),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

  const typingNames = useCallback((cid: number) => Object.values(typing[cid] ?? {}).map((t) => t.name.split(" ")[0]), [typing]);

  // ───── presence helpers ─────
  const isOnline = useCallback((u: User) => (presence[u.id] ? presence[u.id].online : u.online), [presence]);
  const lastSeenOf = useCallback((u: User) => (presence[u.id]?.last_seen_at ?? u.last_seen_at), [presence]);

  const startDirect = useCallback(async (userId: number) => {
    try {
      const c = await api.createDirect(userId);
      upsertConversation(c);
      setModal(null);
      await openConversation(c.id);
    } catch (e) { toast({ kind: "error", title: "Couldn't start chat", body: errMsg(e) }); }
  }, [openConversation, toast, upsertConversation]);

  const createGroup = useCallback(async (name: string, memberIds: number[]) => {
    const c = await api.createGroup(name, memberIds); // errors surface in the modal
    upsertConversation(c);
    setModal(null);
    toast({ kind: "success", title: `Group "${c.title}" created` });
    await openConversation(c.id);
  }, [openConversation, toast, upsertConversation]);

  // ───── auth ─────
  const signIn = useCallback((t: string, user: User) => {
    try { localStorage.setItem(TOKEN_KEY, t); } catch { /* */ }
    setToken(t);
    setTokenState(t);
    setMeState(user);
  }, []);

  const resetSession = useCallback(() => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* */ }
    setToken(null);
    setTokenState(null);
    setMeState(null);
    setConvs({}); setConvsLoading(true); setMessages({}); setHasMore({}); setActiveId(null); setTyping({}); setPresence({}); setModal(null);
    typingSent.current = {};
  }, []);

  const signOut = useCallback(async () => {
    try { await api.logout(); } catch { /* token may already be invalid */ }
    wsRef.current?.close();
    resetSession();
  }, [resetSession]);

  useEffect(() => { setUnauthorizedHandler(() => { resetSession(); }); }, [resetSession]);

  // boot: restore persisted session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let t: string | null = null;
      try { t = localStorage.getItem(TOKEN_KEY); } catch { /* */ }
      if (t) {
        setToken(t);
        try {
          const u = await api.me();
          if (!cancelled) { setTokenState(t); setMeState(u); }
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) { try { localStorage.removeItem(TOKEN_KEY); } catch { /* */ } setToken(null); }
          else if (!cancelled) { setTokenState(t); }
        }
      }
      if (!cancelled) setBooting(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // initial conversation load after login
  useEffect(() => {
    if (!token || !me) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the initial fetch
    setConvsLoading(true);
    refreshConversations().finally(() => setConvsLoading(false));
  }, [token, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ───── websocket ─────
  useEffect(() => {
    if (!token || !me) return;
    let closed = false;
    let retry = 0;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    const myId = me.id;

    const notify = (m: Message) => {
      if (!R.current.prefs.notifications) return;
      const conv = R.current.convs[m.conversation_id];
      const name = m.sender?.display_name ?? "New message";
      const title = conv?.type === "group" ? `${conv.title}` : name;
      const body = (conv?.type === "group" ? `${name}: ` : "") + previewOf(m);
      toast({ kind: "message", title, body, onClick: () => openConversation(m.conversation_id) });
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        try { new Notification(title, { body }); } catch { /* */ }
      }
    };

    const handle = (ev: Record<string, any>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      switch (ev.type) {
        case "ready": {
          setPresence((p) => { const n = { ...p }; for (const id of ev.online_user_ids as number[]) n[id] = { online: true, last_seen_at: null }; return n; });
          refreshConversations();
          const aid = R.current.activeId;
          if (aid) loadMessages(aid).then(() => { if (document.hasFocus()) markRead(aid); });
          break;
        }
        case "message.new": {
          const m = ev.message as Message;
          upsertMessage(m);
          const incoming = m.sender_id !== myId && m.kind === "text";
          const viewing = R.current.activeId === m.conversation_id && document.visibilityState === "visible" && document.hasFocus();
          const known = R.current.convs[m.conversation_id];
          if (!known) {
            api.conversation(m.conversation_id).then(upsertConversation).catch(() => {});
          } else {
            patchConv(m.conversation_id, (c) => ({
              ...c, last_message: m, updated_at: m.created_at,
              unread_count: incoming && !viewing ? c.unread_count + 1 : c.unread_count,
            }));
          }
          if (m.sender_id) setTyping((p) => { const c = { ...(p[m.conversation_id] ?? {}) }; delete c[m.sender_id!]; return { ...p, [m.conversation_id]: c }; });
          if (incoming) { if (viewing) wsSend({ type: "read", conversation_id: m.conversation_id }); else notify(m); }
          break;
        }
        case "message.updated": {
          const m = ev.message as Message;
          upsertMessage(m);
          patchConv(m.conversation_id, (c) => (c.last_message?.id === m.id ? { ...c, last_message: m } : c));
          break;
        }
        case "message.status": {
          const cid = ev.conversation_id as number;
          const ups = ev.updates as { id: number; status: MsgStatus; receipts: Message["receipts"] }[];
          const map = new Map(ups.map((u) => [u.id, u]));
          setMessages((p) => (p[cid] ? { ...p, [cid]: p[cid].map((m) => (map.has(m.id) ? { ...m, status: best(m.status, map.get(m.id)!.status), receipts: map.get(m.id)!.receipts } : m)) } : p));
          patchConv(cid, (c) => (c.last_message && map.has(c.last_message.id) ? { ...c, last_message: { ...c.last_message, status: best(c.last_message.status, map.get(c.last_message.id)!.status) } } : c));
          break;
        }
        case "message.expired": {
          const cid = ev.conversation_id as number;
          const ids = new Set(ev.message_ids as number[]);
          setMessages((p) => (p[cid] ? { ...p, [cid]: p[cid].filter((m) => !ids.has(m.id)) } : p));
          break;
        }
        case "conversation.updated": upsertConversation(ev.conversation as Conversation); break;
        case "conversation.removed": {
          const cid = ev.conversation_id as number;
          setConvs((p) => { const n = { ...p }; delete n[cid]; return n; });
          setMessages((p) => { const n = { ...p }; delete n[cid]; return n; });
          if (R.current.activeId === cid) { setActiveId(null); toast({ kind: "info", title: "You're no longer in that group" }); }
          break;
        }
        case "conversation.read": patchConv(ev.conversation_id, (c) => (c.unread_count ? { ...c, unread_count: 0 } : c)); break;
        case "typing": {
          const cid = ev.conversation_id as number, u = ev.user_id as number;
          setTyping((p) => {
            const c = { ...(p[cid] ?? {}) };
            if (ev.is_typing) c[u] = { name: ev.name as string, at: Date.now() }; else delete c[u];
            return { ...p, [cid]: c };
          });
          break;
        }
        case "presence": setPresence((p) => ({ ...p, [ev.user_id]: { online: ev.online, last_seen_at: ev.last_seen_at } })); break;
      }
    };

    const connect = () => {
      if (closed) return;
      setWsStatus("connecting");
      const ws = new WebSocket(`${WS_URL}/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onopen = () => { retry = 0; setWsStatus("open"); };
      ws.onmessage = (e) => { try { handle(JSON.parse(e.data)); } catch { /* ignore malformed */ } };
      ws.onclose = (e) => {
        clearInterval(pingTimer);
        setWsStatus("closed");
        typingSent.current = {};
        if (closed) return;
        if (e.code === 4401) { resetSession(); return; }
        reconnectTimer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 10000));
      };
      ws.onerror = () => ws.close();
      pingTimer = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send('{"type":"ping"}'); }, 25000);
    };
    connect();
    return () => { closed = true; clearInterval(pingTimer); clearTimeout(reconnectTimer); wsRef.current?.close(); };
  }, [token, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // expire stale typing indicators
  useEffect(() => {
    const t = setInterval(() => setTyping((p) => {
      const now = Date.now(); let changed = false; const n: typeof p = {};
      for (const [cid, users] of Object.entries(p)) {
        const kept = Object.fromEntries(Object.entries(users).filter(([, v]) => now - v.at < 5000));
        if (Object.keys(kept).length !== Object.keys(users).length) changed = true;
        n[+cid] = kept;
      }
      return changed ? n : p;
    }), 1000);
    return () => clearInterval(t);
  }, []);

  // mark read when the window regains focus on an open chat
  useEffect(() => {
    const onFocus = () => { const id = R.current.activeId; if (id && R.current.convs[id]?.unread_count) markRead(id); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [markRead]);

  const conversations = useMemo(() => Object.values(convs).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)), [convs]);
  const setMe = useCallback((u: User) => setMeState(u), []);

  const value: Ctx = {
    booting, token, me, setMe, signIn, signOut, conversations, convsLoading, convsError, refreshConversations,
    activeId, active: activeId ? convs[activeId] ?? null : null, openConversation, closeConversation,
    messages, hasMore, messagesLoading, messagesError, loadOlder, unreadMarker, sendMessage, retryMessage, react, deleteMessage,
    sendTyping, typingNames, isOnline, lastSeenOf, startDirect, createGroup, upsertConversation, wsStatus,
    toasts, toast, dismissToast, theme, setTheme, prefs, setPref, modal, openModal: setModal, closeModal: () => setModal(null),
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
