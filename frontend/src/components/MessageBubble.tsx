"use client";

import { memo, useState } from "react";
import { Copy, CornerUpLeft, FileText, Info, SmilePlus, Trash2, Clock, MoreHorizontal, RotateCw } from "lucide-react";
import { assetUrl } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { fileSize, timeOnly } from "@/lib/format";
import type { Conversation, Message } from "@/lib/types";
import { Avatar, ReceiptIcon } from "./ui";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;

function Linkified({ text, mine }: { text: string; mine: boolean }) {
  return <>{text.split(URL_RE).map((part, i) => i % 2 === 1 ? (
    <a key={i} href={part.startsWith("www.") ? `https://${part}` : part} target="_blank" rel="noopener noreferrer" className={`underline underline-offset-2 ${mine ? "text-white" : "text-accent"}`}>{part}</a>
  ) : <span key={i}>{part}</span>)}</>;
}

interface Props {
  msg: Message; conv: Conversation; first: boolean; last: boolean;
  onReply: (m: Message) => void; onJumpTo: (id: number) => void;
}

function BubbleImpl({ msg, conv, first, last, onReply, onJumpTo }: Props) {
  const { me, react, deleteMessage, retryMessage, toast } = useApp();
  const mine = msg.sender_id === me?.id;
  const isGroup = conv.type === "group";
  const [tools, setTools] = useState(false);
  const [picker, setPicker] = useState(false);
  const [more, setMore] = useState(false);
  const [info, setInfo] = useState(false);

  if (msg.kind === "system") {
    return <div className="my-3 flex justify-center"><span className="rounded-full bg-field px-3 py-1 text-center text-xs text-muted">{msg.body}</span></div>;
  }

  const att = msg.attachment;
  const isImg = !!att?.type?.startsWith("image/");
  const imageOnly = isImg && !msg.body && !msg.reply_to;
  const radius = mine
    ? `rounded-[20px] ${!first ? "rounded-tr-[6px]" : ""} ${!last ? "rounded-br-[6px]" : ""}`
    : `rounded-[20px] ${!first ? "rounded-tl-[6px]" : ""} ${!last ? "rounded-bl-[6px]" : ""}`;
  const mineReacted = (e: string) => msg.reactions.find((r) => r.emoji === e)?.user_ids.includes(me?.id ?? -1);
  const members = new Map(conv.members.map((m) => [m.id, m.display_name]));

  const meta = (
    <span className={`flex items-center gap-1 text-[11px] ${imageOnly ? "absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-white" : mine ? "text-white/75" : "text-muted"}`}>
      {msg.expires_at && <Clock size={10} aria-label="Disappearing message" />}
      {timeOnly(msg.created_at)}
      {mine && <ReceiptIcon status={msg.status} className={msg.status === "read" ? "text-white" : ""} />}
    </span>
  );

  return (
    <div data-msg-id={msg.id} data-testid="message" className={`group relative flex items-end gap-2 ${mine ? "flex-row-reverse" : ""} ${last ? "mb-2.5" : "mb-[3px]"} ${msg.reactions.length ? "mb-5" : ""}`}>
      {isGroup && !mine && (
        <div className="w-7 shrink-0">{last && msg.sender && <Avatar name={msg.sender.display_name} color={msg.sender.avatar_color} url={msg.sender.avatar_url} size={28} />}</div>
      )}

      <div className={`relative flex max-w-[82%] flex-col md:max-w-[68%] ${mine ? "items-end" : "items-start"}`}>
        <div onClick={() => setTools((v) => !v)}
          style={{ ["--rc-bg" as string]: "var(--c-out)" }}
          className={`anim-bubble relative cursor-default ${imageOnly ? "overflow-hidden p-0" : "px-3.5 pb-2 pt-2"} ${radius} ${mine ? "bg-outb text-outb-fg" : "bg-inb text-inb-fg"} ${msg.status === "failed" ? "opacity-70" : ""}`}>
          {isGroup && !mine && first && msg.sender && (
            <p className="mb-0.5 text-[13px] font-semibold" style={{ color: msg.sender.avatar_color }}>{msg.sender.display_name}</p>
          )}

          {msg.is_deleted ? (
            <p className="flex items-center gap-1.5 pr-16 text-sm italic opacity-80"><Trash2 size={13} /> {mine ? "You deleted this message" : "This message was deleted"}</p>
          ) : (<>
            {msg.reply_to && (
              <button onClick={(e) => { e.stopPropagation(); onJumpTo(msg.reply_to!.id); }}
                className={`mb-1.5 block w-full min-w-[160px] rounded-xl border-l-4 px-2.5 py-1.5 text-left text-[13px] ${mine ? "border-white/70 bg-white/15" : "border-accent bg-black/5 dark:bg-white/10"}`}>
                <span className="block font-semibold">{msg.reply_to.sender_id === me?.id ? "You" : msg.reply_to.sender_name}</span>
                <span className="line-clamp-2 opacity-80">{msg.reply_to.is_deleted ? "Message deleted" : msg.reply_to.body || (msg.reply_to.attachment_type?.startsWith("image/") ? "📷 Photo" : "📎 Attachment")}</span>
              </button>
            )}
            {att && isImg && (
              <a href={assetUrl(att.url)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={imageOnly ? "block" : "mb-1.5 block overflow-hidden rounded-xl"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assetUrl(att.url)} alt={att.name ?? "image"} loading="lazy" className="max-h-72 w-full max-w-[320px] object-cover" />
              </a>
            )}
            {att && !isImg && (
              <a href={assetUrl(att.url)} target="_blank" rel="noopener noreferrer" download={att.name ?? undefined} onClick={(e) => e.stopPropagation()}
                className={`mb-1.5 flex min-w-[200px] items-center gap-3 rounded-xl p-2.5 ${mine ? "bg-white/15" : "bg-black/5 dark:bg-white/10"}`}>
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${mine ? "bg-white/20" : "bg-accent-soft text-accent"}`}><FileText size={20} /></span>
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{att.name}</span><span className="text-xs opacity-75">{fileSize(att.size)}</span></span>
              </a>
            )}
            {msg.body && (
              <p className="whitespace-pre-wrap break-words text-[16px] leading-[1.35]" style={{ overflowWrap: "anywhere" }}>
                <Linkified text={msg.body} mine={mine} />
                <span className="inline-block w-[72px] align-bottom" aria-hidden />
              </p>
            )}
          </>)}
          {!imageOnly && (msg.is_deleted || msg.body || att) && <div className={`${msg.body && !msg.is_deleted ? "absolute bottom-1.5 right-3" : "mt-0.5 flex justify-end"}`}>{meta}</div>}
          {imageOnly && !msg.is_deleted && meta}
        </div>

        {msg.reactions.length > 0 && (
          <div className={`absolute -bottom-3.5 flex gap-1 ${mine ? "right-2" : "left-2"}`}>
            {msg.reactions.map((r) => (
              <button key={r.emoji} onClick={() => react(msg, r.emoji)} title={r.user_ids.map((id) => (id === me?.id ? "You" : members.get(id) ?? "Someone")).join(", ")}
                className={`flex items-center gap-1 rounded-full border bg-bg px-1.5 py-[1px] text-xs shadow-sm ${mineReacted(r.emoji) ? "border-accent" : "border-line"}`}>
                <span>{r.emoji}</span>{r.count > 1 && <span className="font-semibold text-muted">{r.count}</span>}
              </button>))}
          </div>
        )}

        {msg.status === "failed" && (
          <button onClick={() => retryMessage(msg)} className="mt-1 flex items-center gap-1 text-xs font-medium text-danger"><RotateCw size={12} /> Not sent. Tap to retry</button>
        )}

        {info && mine && msg.receipts && (
          <p className="mt-1 text-[11px] text-muted">Delivered to {msg.receipts.delivered}/{msg.receipts.total} · Read by {msg.receipts.read}/{msg.receipts.total}</p>
        )}
      </div>

      {/* hover / tap toolbar */}
      {!msg.is_deleted && msg.id > 0 && (
        <div className={`relative flex items-center gap-0.5 self-center opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 ${tools ? "opacity-100" : ""}`}>
          <button aria-label="React" onClick={() => { setPicker((v) => !v); setMore(false); }} className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-fg"><SmilePlus size={16} /></button>
          <button aria-label="Reply" onClick={() => onReply(msg)} className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-fg"><CornerUpLeft size={16} /></button>
          <button aria-label="More" onClick={() => { setMore((v) => !v); setPicker(false); }} className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-fg"><MoreHorizontal size={16} /></button>
          {picker && (
            <div className={`anim-pop absolute bottom-9 z-20 flex gap-1 rounded-full border border-line bg-bg p-1.5 shadow-[var(--c-shadow)] ${mine ? "right-0" : "left-0"}`}>
              {QUICK_REACTIONS.map((e) => (
                <button key={e} onClick={() => { react(msg, e); setPicker(false); setTools(false); }} className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:scale-125 hover:bg-hover">{e}</button>))}
            </div>
          )}
          {more && (
            <div className={`anim-pop absolute bottom-9 z-20 w-44 overflow-hidden rounded-xl border border-line bg-bg py-1 shadow-[var(--c-shadow)] ${mine ? "right-0" : "left-0"}`}>
              {msg.body && <button onClick={() => { navigator.clipboard?.writeText(msg.body); toast({ kind: "success", title: "Copied" }); setMore(false); }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-hover"><Copy size={15} className="text-muted" /> Copy text</button>}
              {mine && <button onClick={() => { setInfo((v) => !v); setMore(false); }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-hover"><Info size={15} className="text-muted" /> Message info</button>}
              {mine && <button onClick={() => { deleteMessage(msg); setMore(false); }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-danger hover:bg-hover"><Trash2 size={15} /> Delete for everyone</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const MessageBubble = memo(BubbleImpl);
