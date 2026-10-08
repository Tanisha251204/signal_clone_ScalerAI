"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, FileText, Mic, Plus, Send, Sticker, X } from "lucide-react";
import { api, ApiError, assetUrl } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { fileSize } from "@/lib/format";
import type { Attachment, Conversation, Message } from "@/lib/types";
import { Spinner } from "./ui";

const EMOJIS = "😀 😂 🥹 😍 😘 😎 🤔 😅 😭 😡 👍 👎 👏 🙌 🙏 💪 🔥 ✨ 🎉 ❤️ 💙 💔 👀 🤝 ☕ 🍕 🎂 🚀 ✅ ❌ 😴 🤯 🥳 😇 🙈 💯".split(" ");
const drafts = new Map<number, string>();
const iconBtn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg transition hover:bg-hover";
const roundBtn = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-hover hover:text-fg";

export function Composer({ conv, replyTo, onClearReply, focusSignal, incomingFile }: { conv: Conversation; replyTo: Message | null; onClearReply: () => void; focusSignal: number; incomingFile?: { file: File; n: number } | null }) {
  const { sendMessage, sendTyping, prefs, toast, openModal } = useApp();
  const [text, setText] = useState(() => drafts.get(conv.id) ?? "");
  const [emoji, setEmoji] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { ta.current?.focus(); }, [conv.id, replyTo, focusSignal]);
  useEffect(() => { // auto-grow
    const el = ta.current; if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);
  useEffect(() => () => { clearTimeout(idle.current); sendTyping(conv.id, false); }, [conv.id, sendTyping]);

  function onChange(v: string) {
    setText(v);
    drafts.set(conv.id, v);
    if (v.trim()) {
      sendTyping(conv.id, true);
      clearTimeout(idle.current);
      idle.current = setTimeout(() => sendTyping(conv.id, false), 2500);
    } else { clearTimeout(idle.current); sendTyping(conv.id, false); }
  }

  async function submit() {
    const body = text.trim();
    if ((!body && !attachment) || uploading) return;
    setText(""); drafts.delete(conv.id);
    const att = attachment, reply = replyTo;
    setAttachment(null); onClearReply(); setEmoji(false);
    clearTimeout(idle.current);
    await sendMessage(conv.id, { body, replyTo: reply, attachment: att });
  }

  async function pick(file?: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast({ kind: "error", title: "File too large", body: "Maximum size is 10 MB." });
    setUploading(true);
    try {
      const r = await api.upload(file);
      setAttachment({ url: r.url, name: r.name, type: r.type, size: r.size });
    } catch (e) { toast({ kind: "error", title: "Upload failed", body: e instanceof ApiError ? e.message : undefined }); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; if (imageRef.current) imageRef.current.value = ""; }
  }

  const lastIncoming = useRef(0);
  useEffect(() => { // a file dropped anywhere on the chat panel (handled in ChatView)
    if (incomingFile && incomingFile.n !== lastIncoming.current) { lastIncoming.current = incomingFile.n; void pick(incomingFile.file); }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pick is recreated every render; only react to a new drop
  }, [incomingFile]);

  function onPaste(e: React.ClipboardEvent) { // pasting a screenshot / file from the clipboard attaches it
    const f = e.clipboardData?.files?.[0];
    if (f) { e.preventDefault(); void pick(f); }
  }

  const canSend = (!!text.trim() || !!attachment) && !uploading;
  return (
    <div className="relative bg-chat px-2.5 pb-3 pt-2 md:px-4">
      {replyTo && (
        <div className="anim-pop mb-2 flex items-center gap-3 rounded-2xl border-l-4 border-accent bg-field px-3 py-2">
          <div className="min-w-0 flex-1 text-[13px]"><p className="font-medium text-accent">Replying to {replyTo.sender?.display_name ?? "message"}</p>
            <p className="truncate text-muted">{replyTo.body || (replyTo.attachment ? "Attachment" : "")}</p></div>
          <button aria-label="Cancel reply" onClick={onClearReply} className="text-muted hover:text-fg"><X size={18} /></button>
        </div>
      )}
      {(attachment || uploading) && (
        <div className="anim-pop mb-2 flex items-center gap-3 rounded-2xl bg-field p-2">
          {uploading ? <Spinner size={22} className="mx-2" /> : attachment?.type?.startsWith("image/")
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={assetUrl(attachment.url)} alt="" className="h-12 w-12 rounded-lg object-cover" />
            : <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent"><FileText size={22} /></span>}
          <div className="min-w-0 flex-1 text-sm"><p className="truncate font-medium">{uploading ? "Uploading…" : attachment?.name}</p>{attachment && <p className="text-xs text-muted">{fileSize(attachment.size)}</p>}</div>
          {attachment && <button aria-label="Remove attachment" onClick={() => setAttachment(null)} className="p-1 text-muted hover:text-fg"><X size={18} /></button>}
        </div>
      )}
      {emoji && (
        <div className="anim-pop absolute bottom-full left-3 z-20 mb-1 grid w-[min(92vw,300px)] grid-cols-6 gap-1 rounded-2xl bg-sheet p-2 shadow-[var(--c-shadow)] md:left-4">
          {EMOJIS.map((e) => <button key={e} onClick={() => { onChange(text + e); ta.current?.focus(); }} className="flex h-9 w-9 items-center justify-center rounded-lg text-xl hover:bg-hover">{e}</button>)}
        </div>
      )}
      <div className="flex items-end gap-1.5">
        <input ref={fileRef} type="file" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <input ref={imageRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <button aria-label="Attach file" onClick={() => fileRef.current?.click()} className={`mb-0.5 ${iconBtn}`}><Plus size={28} strokeWidth={1.6} /></button>
        <div className="flex min-h-[44px] min-w-0 flex-1 items-end rounded-[24px] bg-field pl-4 pr-1.5">
          <textarea ref={ta} rows={1} value={text} placeholder="Message" aria-label="Message" data-testid="composer"
            onChange={(e) => onChange(e.target.value)} onPaste={onPaste}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && (prefs.enterToSend || e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
            className="max-h-[140px] min-w-0 flex-1 resize-none bg-transparent py-[11px] text-[17px] leading-[1.3] outline-none placeholder:text-muted focus-visible:outline-none" />
          <button aria-label="Emoji" onClick={() => setEmoji((v) => !v)} className={`mb-[2px] ${roundBtn} ${emoji ? "bg-hover text-fg" : ""}`}><Sticker size={24} strokeWidth={1.6} /></button>
        </div>
        {canSend ? (
          <button aria-label="Send message" data-testid="send" onClick={submit} className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-outb text-white transition hover:brightness-110 active:scale-95"><Send size={19} className="-ml-0.5 mt-0.5" /></button>
        ) : (
          <>
            <button aria-label="Camera" onClick={() => imageRef.current?.click()} className={`mb-0.5 ${iconBtn}`}><Camera size={26} strokeWidth={1.6} /></button>
            <button aria-label="Voice message" onClick={() => openModal({ type: "comingSoon", feature: "Voice messages" })} className={`mb-0.5 ${iconBtn}`}><Mic size={26} strokeWidth={1.6} /></button>
          </>
        )}
      </div>
    </div>
  );
}
