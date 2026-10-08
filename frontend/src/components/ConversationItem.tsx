"use client";

import { useApp } from "@/context/AppContext";
import { listTime, previewOf } from "@/lib/format";
import type { Conversation } from "@/lib/types";
import { Avatar, ReceiptIcon } from "./ui";

export function ConversationItem({ conv, selected, onClick }: { conv: Conversation; selected: boolean; onClick: () => void }) {
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
    <button onClick={onClick} aria-current={selected} data-testid="conversation-item"
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${selected ? "bg-selected" : "hover:bg-hover"}`}>
      <Avatar name={conv.title} color={conv.type === "direct" ? conv.peer?.avatar_color ?? conv.avatar_color : conv.avatar_color} url={conv.peer?.avatar_url} online={online} size={52} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-[16px] ${unread ? "font-bold" : "font-medium"}`}>{conv.title}</span>
          {last && <span className={`shrink-0 text-xs ${unread ? "font-semibold text-accent" : "text-muted"}`}>{listTime(last.created_at)}</span>}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className={`line-clamp-1 flex-1 text-[14px] ${unread ? "font-medium text-fg" : "text-muted"}`}>{preview}</p>
          {unread ? (
            <span data-testid="unread-badge" className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-outb px-1.5 text-[11px] font-bold text-white">
              {conv.unread_count > 99 ? "99+" : conv.unread_count}
            </span>
          ) : mine && last?.kind === "text" ? (
            <span className={`shrink-0 ${last.status === "read" ? "text-accent" : "text-muted"}`} style={{ ["--rc-bg" as string]: "var(--c-sidebar)" }}>
              <ReceiptIcon status={last.status} />
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
