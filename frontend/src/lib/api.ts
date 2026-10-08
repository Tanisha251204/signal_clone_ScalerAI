import { API_URL } from "./config";
import type { Conversation, Message, SearchResults, User } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;
export const setToken = (t: string | null) => { token = t; };
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };
export const assetUrl = (u: string | null | undefined) => (!u ? "" : u.startsWith("http") || u.startsWith("blob:") ? u : `${API_URL}${u}`);

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (!(init.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : Array.isArray(j.detail) ? j.detail.map((d: { msg: string }) => d.msg).join(", ") : msg;
    } catch { /* ignore */ }
    if (res.status === 401 && token && onUnauthorized) onUnauthorized();
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}
const post = <T>(p: string, body?: unknown) => req<T>(p, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const patch = <T>(p: string, body: unknown) => req<T>(p, { method: "PATCH", body: JSON.stringify(body) });
const del = <T>(p: string) => req<T>(p, { method: "DELETE" });

export const api = {
  requestOtp: (identifier: string) => post<{ identifier: string; kind: string; exists: boolean; otp_hint: string }>("/api/auth/request-otp", { identifier }),
  login: (identifier: string, otp: string) => post<{ token: string; user: User }>("/api/auth/login", { identifier, otp }),
  register: (b: { identifier: string; otp: string; display_name: string; avatar_color?: string; avatar_url?: string | null }) =>
    post<{ token: string; user: User }>("/api/auth/register", b),
  logout: () => post<{ ok: boolean }>("/api/auth/logout"),
  demoUsers: () => req<{ display_name: string; phone: string; avatar_color: string }[]>("/api/auth/demo-users"),
  me: () => req<User>("/api/me"),
  updateMe: (b: Partial<Pick<User, "display_name" | "about" | "avatar_color" | "avatar_url" | "username">>) => patch<User>("/api/me", b),
  contacts: () => req<User[]>("/api/contacts"),
  addContact: (b: { user_id?: number; identifier?: string }) => post<User>("/api/contacts", b),
  searchUsers: (q: string) => req<User[]>(`/api/users/search?q=${encodeURIComponent(q)}`),
  search: (q: string) => req<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`),
  conversations: () => req<Conversation[]>("/api/conversations"),
  conversation: (id: number) => req<Conversation>(`/api/conversations/${id}`),
  createDirect: (user_id: number) => post<Conversation>("/api/conversations/direct", { user_id }),
  createGroup: (name: string, member_ids: number[]) => post<Conversation>("/api/conversations/group", { name, member_ids }),
  updateConversation: (id: number, b: { name?: string; disappear_after?: number | null; clear_disappear?: boolean }) => patch<Conversation>(`/api/conversations/${id}`, b),
  addMembers: (id: number, user_ids: number[]) => post<Conversation>(`/api/conversations/${id}/members`, { user_ids }),
  removeMember: (id: number, uid: number) => del<{ ok: boolean }>(`/api/conversations/${id}/members/${uid}`),
  setRole: (id: number, uid: number, role: "admin" | "member") => patch<Conversation>(`/api/conversations/${id}/members/${uid}`, { role }),
  messages: (id: number, before?: number) => req<{ messages: Message[]; has_more: boolean }>(`/api/conversations/${id}/messages?limit=40${before ? `&before_id=${before}` : ""}`),
  sendMessage: (id: number, b: { body: string; client_id: string; reply_to_id?: number | null; attachment_url?: string; attachment_name?: string | null; attachment_type?: string | null; attachment_size?: number | null }) =>
    post<Message>(`/api/conversations/${id}/messages`, b),
  markRead: (id: number) => post<{ updated: number }>(`/api/conversations/${id}/read`),
  react: (mid: number, emoji: string) => post<Message>(`/api/messages/${mid}/reactions`, { emoji }),
  deleteMessage: (mid: number) => del<Message>(`/api/messages/${mid}`),
  upload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return req<{ url: string; name: string; type: string; size: number }>("/api/uploads", { method: "POST", body: fd });
  },
};
