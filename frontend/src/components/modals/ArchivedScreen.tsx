"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import type { Conversation } from "@/lib/types";
import { ConversationItem } from "../ConversationItem";
import { RowMenu } from "../RowMenu";
import { Screen } from "../ui";

/** Chat list menu → Archived chats. Right-click or long-press a chat to unarchive it. */
export function ArchivedScreen() {
  const { conversations, archivedIds, closeModal, openConversation } = useApp();
  const [menu, setMenu] = useState<{ conv: Conversation; x: number; y: number } | null>(null);
  const list = conversations.filter((c) => archivedIds.includes(c.id));
  return (
    <Screen label="Archived chats" title="Archived chats" onBack={closeModal}>
      {list.length === 0 ? (
        <div className="px-8 py-20 text-center text-muted"><p className="text-[16px] font-medium text-fg">No archived chats</p><p className="mt-1 text-[14px]">Right-click or press and hold a chat in your list to archive it.</p></div>
      ) : (
        <div className="pt-1">
          {list.map((c) => <ConversationItem key={c.id} conv={c} selected={false} onClick={() => { closeModal(); openConversation(c.id); }} onMenu={(p) => setMenu({ conv: c, ...p })} />)}
        </div>
      )}
      {menu && <RowMenu conv={menu.conv} pos={menu} onClose={() => setMenu(null)} />}
    </Screen>
  );
}
