"use client";

import { useApp } from "@/context/AppContext";
import type { Conversation } from "@/lib/types";

/** Small popup for a chat-list row (opened by right-click or long-press): archive / unarchive and mark as read. */
export function RowMenu({ conv, pos, onClose }: { conv: Conversation; pos: { x: number; y: number }; onClose: () => void }) {
  const { archivedIds, setArchived } = useApp();
  const archived = archivedIds.includes(conv.id);
  const w = 220;
  const left = Math.max(8, Math.min(pos.x, (typeof window !== "undefined" ? window.innerWidth : 400) - w - 8));
  const top = Math.max(8, Math.min(pos.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 120));
  return (
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div role="menu" aria-label="Chat options" style={{ left, top, width: w }} className="anim-pop fixed z-[71] overflow-hidden rounded-2xl bg-sheet py-1.5 shadow-[var(--c-shadow)]">
        <button role="menuitem" onClick={() => { setArchived(conv.id, !archived); onClose(); }} className="block w-full px-5 py-3 text-left text-[16px] hover:bg-hover">{archived ? "Unarchive chat" : "Archive chat"}</button>
      </div>
    </>
  );
}
