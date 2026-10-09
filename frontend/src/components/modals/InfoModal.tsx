"use client";

import { useEffect, useState } from "react";
import { Check, LogOut, Pencil, ShieldCheck, Timer, UserPlus, X, Crown } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { timerLabel } from "@/lib/format";
import type { Member, User } from "@/lib/types";
import { Avatar, Button, Modal, Spinner } from "../ui";
import { MemberPicker } from "./NewGroupModal";

export function InfoModal({ conversationId }: { conversationId: number }) {
  const { conversations, me, closeModal, upsertConversation, toast, isOnline, startDirect, openModal } = useApp();
  const conv = conversations.find((c) => c.id === conversationId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [contacts, setContacts] = useState<User[] | null>(null);
  const [found, setFound] = useState<User[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);

  useEffect(() => { if (!conv) closeModal(); }, [conv, closeModal]);
  useEffect(() => { if (adding && !contacts) api.contacts().then(setContacts).catch(() => setContacts([])); }, [adding, contacts]);
  // Typing 2+ characters also searches every Signal user, so people who aren't contacts can be added too.
  useEffect(() => {
    const t = q.trim();
    if (!adding || t.length < 2) return;
    const h = setTimeout(() => api.searchUsers(t).then(setFound).catch(() => setFound([])), 250);
    return () => clearTimeout(h);
  }, [adding, q]);
  if (!conv || !me) return null;

  const isGroup = conv.type === "group";
  const admin = conv.my_role === "admin";
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) { toast({ kind: "error", title: "Action failed", body: e instanceof ApiError ? e.message : undefined }); }
    finally { setBusy(null); }
  };

  const rename = () => run("rename", async () => { if (name.trim() && name.trim() !== conv.name) upsertConversation(await api.updateConversation(conv.id, { name: name.trim() })); setEditing(false); });
    const addMembers = () => run("add", async () => { upsertConversation(await api.addMembers(conv.id, [...sel])); setAdding(false); setSel(new Set()); toast({ kind: "success", title: "Members added" }); });
  const remove = (m: Member) => run(`rm${m.id}`, async () => { await api.removeMember(conv.id, m.id); toast({ kind: "success", title: `${m.display_name} removed` }); setMenuFor(null); });
  const role = (m: Member, r: "admin" | "member") => run(`role${m.id}`, async () => { upsertConversation(await api.setRole(conv.id, m.id, r)); setMenuFor(null); });
  const leave = () => run("leave", async () => { await api.removeMember(conv.id, me.id); closeModal(); toast({ kind: "info", title: `You left "${conv.title}"` }); });

  const shownFound = q.trim().length >= 2 ? found : [];
  const pool = [...(contacts ?? []), ...shownFound.filter((f) => !(contacts ?? []).some((c) => c.id === f.id))];
  const candidates = pool.filter((c) => !conv.members.some((m) => m.id === c.id));
  const peer = conv.peer;

  if (adding) {
    return (
      <Modal title="Add members" onClose={() => setAdding(false)} footer={<><Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button><Button disabled={!sel.size} loading={busy === "add"} onClick={addMembers}>Add {sel.size || ""}</Button></>}>
        <div className="px-4 pb-3">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts or people" aria-label="Search contacts" autoComplete="off" className="mb-2 h-10 w-full rounded-full bg-field px-4 text-sm outline-none focus:ring-2 focus:ring-accent" />
          {contacts === null ? <div className="flex justify-center py-8"><Spinner /></div> : candidates.length === 0 && !q.trim() ? <p className="py-8 text-center text-sm text-muted">All your contacts are already in this group.</p>
            : <MemberPicker users={candidates} selected={sel} q={q} toggle={(u) => setSel((s) => { const n = new Set(s); if (n.has(u.id)) n.delete(u.id); else n.add(u.id); return n; })} />}
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={isGroup ? "Group info" : "Contact info"} onClose={closeModal}>
      <div className="pb-4">
        <div className="flex flex-col items-center gap-2 px-5 pb-4 pt-1 text-center">
          <Avatar name={conv.title} color={isGroup ? conv.avatar_color : peer?.avatar_color ?? conv.avatar_color} url={peer?.avatar_url} size={88} online={peer ? isOnline(peer) : false} />
          {editing ? (
            <div className="flex w-full items-center gap-2">
              <input autoFocus value={name} maxLength={64} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") rename(); if (e.key === "Escape") setEditing(false); }} aria-label="Group name" className="h-10 flex-1 rounded-xl border border-line bg-field px-3 text-center text-base font-semibold outline-none focus:border-accent" />
              <Button loading={busy === "rename"} onClick={rename} className="h-10 w-10 !px-0"><Check size={18} /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-2"><h3 className="text-xl font-bold" data-testid="info-title">{conv.title}</h3>
              {isGroup && admin && <button aria-label="Rename group" onClick={() => { setName(conv.name ?? ""); setEditing(true); }} className="text-muted hover:text-fg"><Pencil size={16} /></button>}</div>
          )}
          {peer && <><p className="text-sm text-muted">{peer.about}</p><p className="text-sm text-muted">{peer.phone ?? `@${peer.username}`}{peer.phone && peer.username ? ` · @${peer.username}` : ""}</p></>}
          {isGroup && <p className="text-sm text-muted">Group · {conv.members.length} members</p>}
        </div>

        <div className="border-y border-line px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><Timer size={20} className="text-muted" /><div><p className="text-[15px] font-medium">Disappearing messages</p>
              <p className="text-[13px] text-muted">{isGroup && !admin ? "Only admins can change this" : conv.disappear_after ? `Messages disappear after ${timerLabel(conv.disappear_after)}` : "New messages stay until deleted"}</p></div></div>
            <button aria-label="Change disappearing messages timer" onClick={() => openModal({ type: "disappearing", conversationId: conv.id })}
              className="h-9 rounded-lg bg-btn2 px-3 text-sm font-medium text-btn2-fg hover:brightness-110">{timerLabel(conv.disappear_after)}</button>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted"><ShieldCheck size={14} /> Messages in this chat are end-to-end encrypted (simulated).</p>
        </div>

        {isGroup && (
          <div className="px-3 pt-3">
            <div className="flex items-center justify-between px-2 pb-1"><h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{conv.members.length} members</h4></div>
            {admin && <button onClick={() => setAdding(true)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-hover">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent"><UserPlus size={19} /></span><span className="text-[15px] font-semibold">Add members</span></button>}
            {conv.members.map((m) => (
              <div key={m.id} className="relative flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-hover" data-testid="member-row">
                <Avatar name={m.display_name} color={m.avatar_color} url={m.avatar_url} size={40} online={isOnline(m)} />
                <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-semibold">{m.id === me.id ? "You" : m.display_name}</p><p className="truncate text-[13px] text-muted">{m.about}</p></div>
                {m.role === "admin" && <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent"><Crown size={11} /> Admin</span>}
                {admin && m.id !== me.id && (<>
                  <button aria-label={`Manage ${m.display_name}`} onClick={() => setMenuFor(menuFor === m.id ? null : m.id)} className="rounded-full px-2 py-1 text-lg leading-none text-muted hover:bg-field">⋯</button>
                  {menuFor === m.id && (<>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                    <div className="anim-pop absolute right-2 top-11 z-20 w-52 overflow-hidden rounded-xl border border-line bg-bg py-1 shadow-[var(--c-shadow)]">
                      <button onClick={() => { setMenuFor(null); startDirect(m.id); }} className="block w-full px-4 py-2 text-left text-sm hover:bg-hover">Message</button>
                      {m.role === "member" ? <button disabled={!!busy} onClick={() => role(m, "admin")} className="block w-full px-4 py-2 text-left text-sm hover:bg-hover">Make admin</button>
                        : <button disabled={!!busy} onClick={() => role(m, "member")} className="block w-full px-4 py-2 text-left text-sm hover:bg-hover">Remove as admin</button>}
                      <button disabled={!!busy} onClick={() => remove(m)} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-danger hover:bg-hover"><X size={14} /> Remove from group</button>
                    </div></>)}
                </>)}
              </div>))}
          </div>
        )}

        {isGroup && <div className="px-5 pt-4"><Button variant="ghost" loading={busy === "leave"} onClick={leave} className="w-full !text-danger"><LogOut size={16} /> Leave group</Button></div>}
        {!isGroup && peer && <div className="px-5 pt-4"><Button variant="ghost" onClick={() => openModal({ type: "comingSoon", feature: "Safety number verification" })} className="w-full"><ShieldCheck size={16} /> View safety number</Button></div>}
      </div>
    </Modal>
  );
}
