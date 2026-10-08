"use client";

import { useRef } from "react";
import { useApp } from "@/context/AppContext";
import { listTime, previewOf } from "@/lib/format";
import type { Conversation } from "@/lib/types";
import { Avatar, ReceiptIcon } from "./ui";

export function ConversationItem({ conv, selected, onClick, onMenu }: { conv: Conversation; selected: boolean; onClick: () => void; onMenu?: (pos: { x: number; y: number }) => void }) {
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);
  const { me, typingNames, isOnline } = useApp();
  const last = conv.last_message;
  const typers = typingNames(conv.id);
  const mine = last?.sender_id === me?.id;
  const unread = conv.unread_count > 0;
  const online = conv.peer ? isOnline(conv.peer) : false;

  let preview: React.ReactNode;
  if (typers.length) preview = <span className="text-accent">{conv.type === "group" ? `${typers.join(", ")} typing…` : "typing…"}</span>;
  else if (!last) preview = <span className="italic">No messages yet</span>;
  else if (last.kind === "system") preview = <span className="italic">{last.body}</span>;
  else {
    const who = mine ? "You: " : conv.type === "group" && last.sender ? `${last.sender.display_name.split(" ")[0]}: ` : "";
    preview = <>{who}{previewOf(last)}</>;
  }

  return (
    <button onClick={() => { if (held.current) { held.current = false; return; } onClick(); }} aria-current={selected} data-testid="conversation-item"
      onContextMenu={(e) => { if (!onMenu) return; e.preventDefault(); onMenu({ x: e.clientX, y: e.clientY }); }}
      onPointerDown={(e) => { if (!onMenu || e.pointerType === "mouse") return; const { clientX: x, clientY: y } = e; hold.current = setTimeout(() => { held.current = true; onMenu({ x, y }); }, 500); }}
      onPointerUp={() => clearTimeout(hold.current)} onPointerLeave={() => clearTimeout(hold.current)} onPointerCancel={() => clearTimeout(hold.current)}
      className={`flex w-full items-center gap-5 px-6 py-[17px] text-left transition ${selected ? "bg-selected" : "hover:bg-hover"}`}>
      <Avatar name={conv.title} color={conv.type === "direct" ? conv.peer?.avatar_color ?? conv.avatar_color : conv.avatar_color} url={conv.peer?.avatar_url} online={online} size={48} />
      <div className="min-w-0 flex-1">
        <span className={`block truncate text-[18px] leading-tight ${unread ? "font-semibold" : ""}`}>{conv.title}</span>
        <p className={`mt-0.5 line-clamp-1 text-[15px] leading-tight ${unread ? "font-medium text-fg" : "text-muted"}`}>{preview}</p>
      </div>
      <div className="flex min-h-[44px] shrink-0 flex-col items-end justify-between">
        {last ? <span className={`text-[14px] ${unread ? "font-semibold text-accent" : "text-muted"}`}>{listTime(last.created_at)}</span> : <span />}
        {unread ? (
          <span data-testid="unread-badge" className="flex h-5 min-w-5 items-center justify-center rounded-full bg-outb px-1.5 text-[11px] font-bold text-white">
            {conv.unread_count > 99 ? "99+" : conv.unread_count}
          </span>
        ) : mine && last?.kind === "text" ? (
          <span className={last.status === "read" ? "text-accent" : "text-muted"} style={{ ["--rc-bg" as string]: "var(--c-sidebar)" }}>
            <ReceiptIcon status={last.status} />
          </span>
        ) : <span />}
      </div>
    </button>
  );
}
