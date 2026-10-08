"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, assetUrl } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Avatar, Screen, Spinner } from "../ui";
import { CameraIcon, PhotoIcon, TextIcon, XIcon } from "../signalIcons";

const PRESETS = ["abstract_01", "abstract_02", "abstract_03", "cat", "dog", "fox", "tucan", "sloth", "dinosour", "pig", "incognito", "ghost"];
const TEXT_COLORS = ["#2C6BED", "#E0457B", "#1B998B", "#8E44AD", "#F29D38", "#D64545", "#3D5A80", "#5B8C5A"];

type Choice = { kind: "current" } | { kind: "none" } | { kind: "preset"; name: string } | { kind: "file"; file: File; url: string } | { kind: "text"; blob: Blob; url: string };

/** Draw a picture (SVG preset) onto a square PNG so it can be uploaded as a normal image. */
function rasterise(src: string, size = 512): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = c.height = size;
      c.getContext("2d")!.drawImage(img, 0, 0, size, size);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("render failed"))), "image/png");
    };
    img.onerror = () => reject(new Error("load failed"));
    img.src = src;
  });
}
function textAvatar(text: string, bg: string, size = 512): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const c = document.createElement("canvas"); c.width = c.height = size;
    const g = c.getContext("2d")!;
    g.fillStyle = bg; g.fillRect(0, 0, size, size);
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `600 ${size * (text.length > 2 ? 0.34 : 0.46)}px Roboto, system-ui, sans-serif`;
    g.fillText(text, size / 2, size / 2 + size * 0.02);
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("render failed"))), "image/png");
  });
}

/** Profile photo editor: camera / photo / text avatars, Signal's default avatars, and Save. */
export function EditPhotoModal() {
  const { me, setMe, openModal, toast } = useApp();
  const [choice, setChoice] = useState<Choice>({ kind: "current" });
  const [textOpen, setTextOpen] = useState(false);
  const [text, setText] = useState("");
  const [color, setColor] = useState(TEXT_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => { const u = urls.current; return () => u.forEach((x) => URL.revokeObjectURL(x)); }, []);
  if (!me) return null;
  const back = () => openModal({ type: "profile" });

  function pickFile(f?: File) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast({ kind: "error", title: "Please choose an image file" });
    const url = URL.createObjectURL(f); urls.current.push(url);
    setChoice({ kind: "file", file: f, url });
  }
  async function makeText() {
    const t = text.trim().slice(0, 3); if (!t) return;
    const blob = await textAvatar(t, color);
    const url = URL.createObjectURL(blob); urls.current.push(url);
    setChoice({ kind: "text", blob, url }); setTextOpen(false);
  }
  async function save() {
    if (choice.kind === "current") return back();
    setBusy(true);
    try {
      let avatar_url: string | null = null;
      if (choice.kind !== "none") {
        const blob: Blob | File = choice.kind === "file" ? choice.file : choice.kind === "text" ? choice.blob : await rasterise(`/avatars/${choice.name}.svg`);
        const file = blob instanceof File ? blob : new File([blob], "avatar.png", { type: "image/png" });
        avatar_url = (await api.upload(file)).url;
      }
      setMe(await api.updateMe({ avatar_url }));
      toast({ kind: "success", title: "Profile photo updated" });
      back();
    } catch (e) { toast({ kind: "error", title: "Couldn't save photo", body: e instanceof ApiError ? e.message : undefined }); setBusy(false); }
  }

  const previewUrl = choice.kind === "current" ? me.avatar_url : choice.kind === "none" ? null : choice.kind === "preset" ? `/avatars/${choice.name}.svg` : choice.url;
  const tile = "flex flex-col items-center gap-2";
  const tileBtn = "flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-accent-soft text-accent transition hover:brightness-110";
  return (
    <Screen label="Edit photo" onBack={back} closeIcon
      footer={<div className="flex justify-end px-5 pb-5 pt-2"><button onClick={save} disabled={busy} className="flex h-11 min-w-[88px] items-center justify-center rounded-full bg-accent-soft px-6 text-[15px] font-medium text-accent transition hover:brightness-110 disabled:opacity-60">{busy ? <Spinner size={18} /> : "Save"}</button></div>}>
      <div className="flex justify-center pb-5 pt-3">
        <div className="relative">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl.startsWith("/uploads") ? assetUrl(previewUrl) : previewUrl} alt="Selected profile photo" className="h-[140px] w-[140px] rounded-full object-cover" />
          ) : <Avatar name={me.display_name} color={me.avatar_color} size={140} />}
          <button aria-label="Remove photo" onClick={() => setChoice({ kind: "none" })} className="absolute -right-1 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-sheet text-fg shadow ring-2 ring-[var(--c-chat)]"><XIcon size={20} /></button>
        </div>
      </div>
      <div className="flex justify-center gap-6 pb-5">
        <input ref={camRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
        <div className={tile}><button aria-label="Camera" onClick={() => camRef.current?.click()} className={tileBtn}><CameraIcon /></button><span className="text-[13px]">Camera</span></div>
        <div className={tile}><button aria-label="Photo" onClick={() => fileRef.current?.click()} className={tileBtn}><PhotoIcon /></button><span className="text-[13px]">Photo</span></div>
        <div className={tile}><button aria-label="Text" onClick={() => setTextOpen(true)} className={tileBtn}><TextIcon /></button><span className="text-[13px]">Text</span></div>
      </div>
      <div className="h-px bg-line" />
      <div className="grid grid-cols-4 gap-x-3 gap-y-4 px-6 py-5" role="listbox" aria-label="Default avatars">
        <button role="option" aria-selected={choice.kind === "current"} aria-label="Current photo" onClick={() => setChoice({ kind: "current" })}
          className={`mx-auto h-[60px] w-[60px] rounded-full ${choice.kind === "current" ? "ring-2 ring-accent ring-offset-2 ring-offset-[var(--c-chat)]" : ""}`}><Avatar name={me.display_name} color={me.avatar_color} url={me.avatar_url} size={60} /></button>
        {PRESETS.map((n) => (
          <button key={n} role="option" aria-selected={choice.kind === "preset" && choice.name === n} aria-label={`Avatar ${n.replace("_", " ")}`} onClick={() => setChoice({ kind: "preset", name: n })}
            className={`mx-auto h-[60px] w-[60px] rounded-full ${choice.kind === "preset" && choice.name === n ? "ring-2 ring-accent ring-offset-2 ring-offset-[var(--c-chat)]" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/avatars/${n}.svg`} alt="" width={60} height={60} className="h-[60px] w-[60px] rounded-full" draggable={false} />
          </button>
        ))}
      </div>

      {textOpen && (
        <div className="anim-fade fixed inset-0 z-[60] flex items-center justify-center bg-[var(--c-overlay)] px-6" onMouseDown={(e) => { if (e.target === e.currentTarget) setTextOpen(false); }}>
          <form role="dialog" aria-modal="true" aria-label="Text avatar" onSubmit={(e) => { e.preventDefault(); void makeText(); }} className="anim-pop w-full max-w-[340px] rounded-[28px] bg-sheet px-6 pb-4 pt-6 shadow-[var(--c-shadow)]">
            <h3 className="text-[22px]">Text avatar</h3>
            <div className="mt-4 flex justify-center"><span className="flex h-[96px] w-[96px] items-center justify-center rounded-full text-[36px] font-semibold text-white" style={{ background: color }}>{text.trim().slice(0, 3) || "Aa"}</span></div>
            <input autoFocus value={text} maxLength={3} onChange={(e) => setText(e.target.value)} placeholder="Up to 3 characters" aria-label="Avatar text" className="mt-4 h-11 w-full rounded-xl bg-field px-4 text-[16px] outline-none ring-accent focus:ring-2" />
            <div className="mt-4 flex flex-wrap justify-center gap-3">{TEXT_COLORS.map((c) => <button type="button" key={c} aria-label={`Colour ${c}`} onClick={() => setColor(c)} className={`h-8 w-8 rounded-full ${color === c ? "ring-2 ring-fg ring-offset-2 ring-offset-[var(--c-sheet)]" : ""}`} style={{ background: c }} />)}</div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setTextOpen(false)} className="rounded-full px-4 py-2 text-[16px] font-medium text-accent hover:bg-hover">Cancel</button>
              <button type="submit" disabled={!text.trim()} className="rounded-full px-4 py-2 text-[16px] font-medium text-accent hover:bg-hover disabled:opacity-40">Done</button>
            </div>
          </form>
        </div>
      )}
    </Screen>
  );
}
