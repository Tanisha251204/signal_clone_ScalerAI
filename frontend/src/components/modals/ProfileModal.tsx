"use client";

import { useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Avatar, Screen } from "../ui";
import { AtIcon, BadgeMultiIcon, EditIcon, PersonIcon } from "../signalIcons";

type Field = "name" | "about" | "username";

function Row({ icon, title, muted, onClick }: { icon: ReactNode; title: string; muted?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-6 px-6 py-[17px] text-left transition hover:bg-hover">
      <span className="flex w-6 shrink-0 justify-center">{icon}</span>
      <span className={`min-w-0 truncate text-[17px] leading-tight ${muted ? "text-muted" : ""}`}>{title}</span>
    </button>
  );
}

/** Settings → your profile: photo, name, about, badges, username. Each field edits in its own small dialog and saves immediately. */
export function ProfileModal() {
  const { me, setMe, openModal, toast } = useApp();
  const [editing, setEditing] = useState<Field | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!me) return null;

  const limits: Record<Field, { title: string; max: number; hint: string }> = {
    name: { title: "Your name", max: 64, hint: "Name" },
    about: { title: "About", max: 140, hint: "Write something…" },
    username: { title: "Username", max: 24, hint: "username" },
  };
  const current = (f: Field) => (f === "name" ? me.display_name : f === "about" ? me.about ?? "" : me.username ?? "");
  function start(f: Field) { setEditing(f); setDraft(current(f)); setError(""); }
  async function save() {
    if (!editing) return;
    const v = draft.trim().replace(editing === "username" ? /^@/ : /$^/, "");
    if (editing === "name" && !v) return setError("Name can't be empty");
    setBusy(true); setError("");
    try {
      const key = editing === "name" ? "display_name" : editing;
      const u = await api.updateMe({ [key]: v } as Parameters<typeof api.updateMe>[0]);
      setMe(u); setEditing(null); toast({ kind: "success", title: "Profile updated" });
    } catch (e) { setError(e instanceof ApiError ? e.message : "Couldn't save"); }
    finally { setBusy(false); }
  }

  return (
    <Screen label="Profile" title="Profile" onBack={() => openModal({ type: "settings" })}>
      <div className="flex flex-col items-center gap-3 pb-3 pt-2">
        <Avatar name={me.display_name} color={me.avatar_color} url={me.avatar_url} size={80} />
        <button onClick={() => openModal({ type: "editPhoto" })} className="rounded-full bg-accent-soft px-4 py-1.5 text-[14px] font-medium text-accent transition hover:brightness-110">Edit photo</button>
      </div>
      <Row icon={<PersonIcon />} title={me.display_name} onClick={() => start("name")} />
      <Row icon={<EditIcon />} title={me.about || "About"} onClick={() => start("about")} />
      <Row icon={<BadgeMultiIcon />} title="Badges" onClick={() => openModal({ type: "comingSoon", feature: "Badges" })} />
      <p className="px-6 pb-4 pt-3 text-[14px] leading-snug text-muted">Your profile and changes to it will be visible to people you message, contacts, and groups.</p>
      <div className="h-px bg-line" />
      <Row icon={<AtIcon />} title={me.username ? `@${me.username}` : "Username"} onClick={() => start("username")} />
      <p className="px-6 pb-6 pt-1 text-[14px] leading-snug text-muted">People can now message you using your optional username so you don&apos;t have to give out your phone number.</p>

      {editing && (
        <div className="anim-fade fixed inset-0 z-[60] flex items-center justify-center bg-[var(--c-overlay)] px-6" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <form role="dialog" aria-modal="true" aria-label={limits[editing].title} onSubmit={(e) => { e.preventDefault(); void save(); }} className="anim-pop w-full max-w-[340px] rounded-[28px] bg-sheet px-6 pb-4 pt-6 shadow-[var(--c-shadow)]">
            <h3 className="text-[22px]">{limits[editing].title}</h3>
            <input autoFocus value={draft} maxLength={limits[editing].max} onChange={(e) => setDraft(e.target.value)} placeholder={limits[editing].hint} aria-label={limits[editing].title}
              className="mt-4 h-11 w-full rounded-xl bg-field px-4 text-[16px] outline-none ring-accent focus:ring-2" />
            {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-full px-4 py-2 text-[16px] font-medium text-accent hover:bg-hover">Cancel</button>
              <button type="submit" disabled={busy} className="rounded-full px-4 py-2 text-[16px] font-medium text-accent hover:bg-hover disabled:opacity-50">Save</button>
            </div>
          </form>
        </div>
      )}
    </Screen>
  );
}
