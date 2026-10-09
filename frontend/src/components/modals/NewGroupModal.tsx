"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Search, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import type { User } from "@/lib/types";
import { Avatar, Button, Modal, Spinner } from "../ui";

export function MemberPicker({ users, selected, toggle, q }: { users: User[]; selected: Set<number>; toggle: (u: User) => void; q: string }) {
  const t = q.trim().toLowerCase();
  const list = users.filter((u) => !t || u.display_name.toLowerCase().includes(t) || (u.phone ?? "").includes(t) || (u.username ?? "").includes(t));
  if (!list.length) return <p className="py-8 text-center text-sm text-muted">No people found</p>;
  return <>{list.map((u) => (
    <button key={u.id} onClick={() => toggle(u)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-hover" role="checkbox" aria-checked={selected.has(u.id)}>
      <Avatar name={u.display_name} color={u.avatar_color} url={u.avatar_url} size={40} />
      <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-semibold">{u.display_name}</p><p className="truncate text-[13px] text-muted">{u.phone ?? `@${u.username}`}</p></div>
      <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${selected.has(u.id) ? "border-accent bg-outb text-white" : "border-line"}`}>{selected.has(u.id) && <Check size={12} strokeWidth={3} />}</span>
    </button>))}</>;
}

export function NewGroupModal() {
  const { closeModal, createGroup } = useApp();
  const [contacts, setContacts] = useState<User[] | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [sel, setSel] = useState<Map<number, User>>(new Map());
  const [q, setQ] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api.contacts().then(setContacts).catch((e) => setLoadErr(e instanceof ApiError ? e.message : "Couldn't load contacts")); }, []);
  const toggle = (u: User) => setSel((m) => { const n = new Map(m); if (n.has(u.id)) n.delete(u.id); else n.set(u.id, u); return n; });

  async function create() {
    if (!name.trim()) return setError("Give your group a name");
    setBusy(true); setError("");
    try { await createGroup(name.trim(), [...sel.keys()]); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Couldn't create the group"); setBusy(false); }
  }

  return (
    <Modal title={step === 1 ? "New group" : "Name your group"} onClose={closeModal}
      footer={step === 1
        ? <><span className="mr-auto text-sm text-muted">{sel.size} selected</span><Button disabled={sel.size === 0} onClick={() => setStep(2)}>Next</Button></>
        : <><Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft size={16} /> Back</Button><Button loading={busy} onClick={create}>Create group</Button></>}>
      {step === 1 ? (
        <div className="px-4 pb-3">
          {sel.size > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{[...sel.values()].map((u) => (
            <span key={u.id} className="flex items-center gap-1.5 rounded-full bg-accent-soft py-1 pl-1 pr-2 text-xs font-medium text-accent">
              <Avatar name={u.display_name} color={u.avatar_color} url={u.avatar_url} size={20} />{u.display_name.split(" ")[0]}
              <button aria-label={`Remove ${u.display_name}`} onClick={() => toggle(u)}><X size={13} /></button></span>))}</div>}
          <div className="relative mb-2"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts" aria-label="Search contacts" className="h-10 w-full rounded-full bg-field pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-accent" /></div>
          {loadErr ? <p className="py-6 text-center text-sm text-danger">{loadErr}</p> : contacts === null ? <div className="flex justify-center py-8"><Spinner /></div> : <MemberPicker users={contacts} selected={new Set(sel.keys())} toggle={toggle} q={q} />}
        </div>
      ) : (
        <div className="space-y-4 px-5 pb-4 pt-2">
          <div className="flex items-center gap-3">
            <Avatar name={name || "G"} color="#2C6BED" size={56} />
            <input autoFocus value={name} onChange={(e) => { setName(e.target.value); setError(""); }} maxLength={64} placeholder="Group name (required)" aria-label="Group name"
              onKeyDown={(e) => { if (e.key === "Enter") create(); }}
              className="h-12 flex-1 rounded-xl border border-line bg-field px-4 text-[15px] outline-none focus:border-accent" />
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{sel.size} members + you</p>
            <div className="flex flex-wrap gap-2">{[...sel.values()].map((u) => <span key={u.id} className="flex items-center gap-1.5 rounded-full bg-field py-1 pl-1 pr-3 text-sm"><Avatar name={u.display_name} color={u.avatar_color} url={u.avatar_url} size={22} />{u.display_name}</span>)}</div></div>
        </div>
      )}
    </Modal>
  );
}
