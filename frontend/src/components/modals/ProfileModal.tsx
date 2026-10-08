"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Avatar, Button, Modal } from "../ui";

const COLORS = ["#2C6BED", "#E0457B", "#1B998B", "#8E44AD", "#F29D38", "#D64545", "#3D5A80", "#5B8C5A"];

export function ProfileModal() {
  const { me, setMe, closeModal, toast } = useApp();
  const [name, setName] = useState(me?.display_name ?? "");
  const [about, setAbout] = useState(me?.about ?? "");
  const [username, setUsername] = useState(me?.username ?? "");
  const [color, setColor] = useState(me?.avatar_color ?? COLORS[0]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(me?.avatar_url ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  if (!me) return null;

  async function pick(f?: File) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("Please choose an image file");
    try { const r = await api.upload(f); setAvatarUrl(r.url); setError(""); } catch (e) { setError(e instanceof ApiError ? e.message : "Upload failed"); }
  }
  async function save() {
    if (!name.trim()) return setError("Name can't be empty");
    setBusy(true); setError("");
    try {
      const u = await api.updateMe({ display_name: name.trim(), about: about.trim(), username: username.trim(), avatar_color: color, avatar_url: avatarUrl });
      setMe(u); toast({ kind: "success", title: "Profile updated" }); closeModal();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Couldn't save"); setBusy(false); }
  }

  const input = "h-11 w-full rounded-xl border border-line bg-field px-3.5 text-[15px] outline-none focus:border-accent";
  return (
    <Modal title="Profile" onClose={closeModal} footer={<><Button variant="ghost" onClick={closeModal}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
      <div className="space-y-4 px-5 pb-4">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Avatar name={name || me.display_name} color={color} url={avatarUrl} size={96} />
            <button aria-label="Change photo" onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-outb text-white shadow ring-2 ring-[var(--c-bg)]"><Camera size={16} /></button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </div>
          <div className="flex items-center gap-2">
            {COLORS.map((c) => <button key={c} aria-label={`Colour ${c}`} onClick={() => { setColor(c); setAvatarUrl(null); }} className={`h-6 w-6 rounded-full ${color === c && !avatarUrl ? "ring-2 ring-offset-2 ring-offset-[var(--c-bg)]" : ""}`} style={{ background: c, ["--tw-ring-color" as string]: c }} />)}
          </div>
          {avatarUrl && <button className="text-xs text-accent" onClick={() => setAvatarUrl(null)}>Remove photo</button>}
        </div>
        <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Name</span><input value={name} maxLength={64} onChange={(e) => setName(e.target.value)} className={input} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">About</span><input value={about} maxLength={140} onChange={(e) => setAbout(e.target.value)} className={input} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Username</span><input value={username} maxLength={24} placeholder="optional" onChange={(e) => setUsername(e.target.value)} className={input} /></label>
        {me.phone && <div><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Phone number</span><p className="rounded-xl bg-field px-3.5 py-3 text-[15px] text-muted">{me.phone}</p></div>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
