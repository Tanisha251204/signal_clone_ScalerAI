"use client";

import { useEffect, useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import type { User } from "@/lib/types";
import { Avatar, Modal, Spinner } from "../ui";

export function UserRow({ u, onClick, right, online }: { u: User; onClick?: () => void; right?: React.ReactNode; online?: boolean }) {
  return (
    <button onClick={onClick} disabled={!onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition enabled:hover:bg-hover">
      <Avatar name={u.display_name} color={u.avatar_color} url={u.avatar_url} size={42} online={online} />
      <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-semibold">{u.display_name}</p>
        <p className="truncate text-[13px] text-muted">{u.phone ?? (u.username ? `@${u.username}` : "")}</p></div>
      {right}
    </button>
  );
}

export function NewChatModal() {
  const { closeModal, openModal, startDirect, toast, isOnline } = useApp();
  const [contacts, setContacts] = useState<User[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<User[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.contacts().then(setContacts).catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load contacts")); }, []);
  useEffect(() => {
    const t = q.trim();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- debounced async search: state mirrors the query
    if (t.length < 2) { setFound([]); return; }
    const h = setTimeout(() => api.searchUsers(t).then(setFound).catch(() => setFound([])), 250);
    return () => clearTimeout(h);
  }, [q]);

  const t = q.trim().toLowerCase();
  const filtered = (contacts ?? []).filter((c) => !t || c.display_name.toLowerCase().includes(t) || (c.phone ?? "").includes(t) || (c.username ?? "").includes(t.replace(/^@/, "")));
  const contactIds = new Set((contacts ?? []).map((c) => c.id));
  const others = found.filter((u) => !contactIds.has(u.id));

  async function lookup() {
    setBusy(true);
    try { const u = await api.addContact({ identifier: q.trim() }); setContacts((c) => [...(c ?? []), u]); await startDirect(u.id); }
    catch (e) { toast({ kind: "error", title: "No Signal user found", body: e instanceof ApiError ? e.message : undefined }); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="New message" onClose={closeModal}>
      <div className="px-4 pb-4">
        <div className="relative mb-2">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, number or username" aria-label="Search contacts"
            className="h-10 w-full rounded-full bg-field pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-accent" />
        </div>
        {!q && (
          <button onClick={() => openModal({ type: "newGroup" })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-hover">
            <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-accent-soft text-accent"><Users size={20} /></span>
            <span className="text-[15px] font-semibold">New group</span>
          </button>
        )}
        {error ? <p className="py-6 text-center text-sm text-danger">{error}</p> : contacts === null ? <div className="flex justify-center py-8"><Spinner /></div> : (<>
          {filtered.length > 0 && <h3 className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">Contacts</h3>}
          {filtered.map((u) => <UserRow key={u.id} u={u} online={isOnline(u)} onClick={() => startDirect(u.id)} />)}
          {others.length > 0 && <h3 className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">On Signal</h3>}
          {others.map((u) => <UserRow key={u.id} u={u} onClick={() => api.addContact({ user_id: u.id }).then(() => startDirect(u.id))} right={<UserPlus size={17} className="text-muted" />} />)}
          {filtered.length === 0 && others.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <p className="text-sm text-muted">{q ? `No one found for “${q.trim()}”.` : "You have no contacts yet."}</p>
              {q.trim().length >= 3 && <button disabled={busy} onClick={lookup} className="rounded-full bg-accent-soft px-4 py-2 text-sm font-semibold text-accent hover:brightness-95">{busy ? "Searching…" : `Look up “${q.trim()}” by number or username`}</button>}
            </div>
          )}
        </>)}
      </div>
    </Modal>
  );
}
