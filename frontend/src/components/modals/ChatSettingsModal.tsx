"use client";

import { useEffect, type ReactNode } from "react";
import { Ban, Bell, ChevronRight, CircleUserRound, Palette, Pencil, Phone, Search, ShieldCheck, Timer, TimerOff, Users, Video, Volume2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { timerLabel } from "@/lib/format";
import { Avatar, Screen } from "../ui";

function Row({ icon, title, sub, onClick, danger }: { icon: ReactNode; title: string; sub?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-5 px-6 py-[15px] text-left transition hover:bg-hover ${danger ? "text-danger" : ""}`}>
      <span className={`flex w-6 shrink-0 justify-center ${danger ? "" : "text-fg"}`}>{icon}</span>
      <span className="min-w-0"><span className="block text-[17px] leading-tight">{title}</span>{sub && <span className="mt-0.5 block text-[15px] text-muted">{sub}</span>}</span>
    </button>
  );
}

/** Per-chat settings page (opened from the chat menu → "Chat settings"), laid out like Signal's conversation settings. */
export function ChatSettingsModal({ conversationId }: { conversationId: number }) {
  const { conversations, closeModal, openModal, closeConversation, isOnline } = useApp();
  const conv = conversations.find((c) => c.id === conversationId);
  useEffect(() => { if (!conv) closeModal(); }, [conv, closeModal]);
  if (!conv) return null;

  const isGroup = conv.type === "group";
  const peer = conv.peer;
  const soon = (feature: string) => () => openModal({ type: "comingSoon", feature });
  const info = () => openModal({ type: "info", conversationId: conv.id });
  const search = () => { // search lives in the chat list: on phones go back to it first
    closeModal();
    if (!window.matchMedia?.("(min-width: 768px)").matches) closeConversation();
    setTimeout(() => window.dispatchEvent(new Event("signal:open-search")), 60);
  };
  const actions = [
    { icon: Video, label: "Video", run: soon("Video calls") },
    { icon: Phone, label: "Audio", run: soon("Voice calls") },
    { icon: Bell, label: "Mute", run: soon("Mute notifications") },
    { icon: Search, label: "Search", run: search },
  ];
  const on = conv.disappear_after !== null;

  return (
    <Screen label="Chat settings" onBack={closeModal}>
      <div className="flex flex-col items-center px-6 pb-6 pt-2">
        <Avatar name={conv.title} color={isGroup ? conv.avatar_color : peer?.avatar_color ?? conv.avatar_color} url={peer?.avatar_url} size={104} online={peer ? isOnline(peer) : false} />
        <button onClick={info} aria-label="Contact details" className="mt-4 flex max-w-full items-center gap-2 rounded-xl px-2 py-1 hover:bg-hover">
          <h2 className="truncate text-[28px] font-medium leading-tight" data-testid="settings-title">{conv.title}</h2>
          {!isGroup && <CircleUserRound size={26} className="shrink-0" />}
          <ChevronRight size={22} className="shrink-0 text-muted" />
        </button>
        {isGroup && <p className="text-[15px] text-muted">Group · {conv.members.length} members</p>}
        <div className="mt-6 grid w-full grid-cols-4 gap-3">
          {actions.map(({ icon: Icon, label, run }) => (
            <button key={label} onClick={run} className="group flex flex-col items-center gap-2">
              <span className="flex h-[60px] w-full items-center justify-center rounded-2xl bg-btn2 text-btn2-fg transition group-hover:brightness-110"><Icon size={23} /></span>
              <span className="text-[16px]">{label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="border-t border-line py-2">
        <Row icon={on ? <Timer size={24} /> : <TimerOff size={24} />} title="Disappearing messages" sub={timerLabel(conv.disappear_after)} onClick={() => openModal({ type: "disappearing", conversationId: conv.id })} />
        {!isGroup && <Row icon={<Pencil size={22} />} title="Nickname" onClick={soon("Nicknames")} />}
        <Row icon={<Palette size={23} />} title="Chat color & wallpaper" onClick={soon("Chat colors and wallpapers")} />
        <Row icon={<Volume2 size={23} />} title="Sounds & notifications" onClick={soon("Per-chat notification settings")} />
        {isGroup ? <Row icon={<Users size={23} />} title="Group info" sub="Members, name and leaving the group" onClick={info} />
          : <Row icon={<CircleUserRound size={24} />} title="Phone contact info" onClick={info} />}
        {!isGroup && <Row icon={<ShieldCheck size={23} />} title="View safety number" onClick={soon("Safety number verification")} />}
      </div>
      {!isGroup && <div className="border-t border-line py-2"><Row icon={<Ban size={23} />} title="Block" danger onClick={soon("Blocking")} /></div>}
    </Screen>
  );
}
