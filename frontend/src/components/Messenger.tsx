"use client";

import { useEffect } from "react";
import { Lock, MessageCircle } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { ChatView } from "./ChatView";
import { Sidebar } from "./Sidebar";
import { ComingSoonModal } from "./modals/ComingSoonModal";
import { ChatSettingsModal } from "./modals/ChatSettingsModal";
import { ConnectionsModal } from "./modals/ConnectionsModal";
import { DisappearingModal } from "./modals/DisappearingModal";
import { InfoModal } from "./modals/InfoModal";
import { NewChatModal } from "./modals/NewChatModal";
import { NewGroupModal } from "./modals/NewGroupModal";
import { ProfileModal } from "./modals/ProfileModal";
import { SettingsModal } from "./modals/SettingsModal";
import { AppearanceScreen, SettingsScreen } from "./modals/SettingsScreens";
import { Button } from "./ui";

export function Messenger() {
  const { activeId, conversations, openConversation, closeConversation, modal, openModal } = useApp();

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "n") { e.preventDefault(); openModal({ type: "newChat" }); }
      else if (e.altKey && e.key.toLowerCase() === "g") { e.preventDefault(); openModal({ type: "newGroup" }); }
      else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && conversations.length) {
        e.preventDefault();
        const i = conversations.findIndex((c) => c.id === activeId);
        const n = e.key === "ArrowDown" ? Math.min(i + 1, conversations.length - 1) : Math.max(i <= 0 ? 0 : i - 1, 0);
        openConversation(conversations[n].id);
      } else if (e.key === "Escape" && !modal && activeId && !(e.target instanceof HTMLInputElement)) closeConversation();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, conversations, modal, openConversation, closeConversation, openModal]);

  return (
    <div className="flex h-full w-full bg-bg">
      <div className={`${activeId ? "hidden md:flex" : "flex"} h-full w-full md:w-auto`}>
        <Sidebar />
      </div>
      <main className={`${activeId ? "flex" : "hidden md:flex"} h-full min-w-0 flex-1`}>
        {activeId ? <ChatView key={activeId} /> : (
          <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 bg-chat px-6 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-[30px] bg-outb text-white shadow-lg"><MessageCircle size={50} fill="currentColor" strokeWidth={1.4} /></div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">Welcome to Signal</h2>
            <p className="max-w-sm text-sm text-muted">Select a conversation from the list, or start a new one. Speak freely.</p>
            <Button onClick={() => openModal({ type: "newChat" })} className="mt-2">Start a new chat</Button>
            <p className="mt-6 flex items-center gap-1.5 text-xs text-muted"><Lock size={12} /> Your messages are end-to-end encrypted (simulated)</p>
          </div>
        )}
      </main>
      {modal?.type === "newChat" && <NewChatModal />}
      {modal?.type === "newGroup" && <NewGroupModal />}
      {modal?.type === "profile" && <ProfileModal />}
      {modal?.type === "settings" && <SettingsScreen />}
      {modal?.type === "preferences" && <SettingsModal />}
      {modal?.type === "appearance" && <AppearanceScreen />}
      {modal?.type === "info" && <InfoModal conversationId={modal.conversationId} />}
      {modal?.type === "connections" && <ConnectionsModal />}
      {modal?.type === "chatSettings" && <ChatSettingsModal conversationId={modal.conversationId} />}
      {modal?.type === "disappearing" && <DisappearingModal conversationId={modal.conversationId} />}
      {modal?.type === "comingSoon" && <ComingSoonModal feature={modal.feature} />}
    </div>
  );
}
