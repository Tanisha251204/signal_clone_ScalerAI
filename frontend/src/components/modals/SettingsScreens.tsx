"use client";

import { useState, type ReactNode } from "react";
import { Bell, ChartPie, CircleHelp, CircleUserRound, Heart, History, Lock, LogOut, Mail, MessageCircle, MonitorSmartphone, SunMedium } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { ThemePref } from "@/lib/types";
import { Avatar, Screen } from "../ui";
import { StoriesIcon } from "../Sidebar";

function Row({ icon, title, sub, onClick, danger }: { icon?: ReactNode; title: string; sub?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-6 px-6 text-left transition hover:bg-hover ${icon ? "py-[16px]" : "py-[14px]"} ${danger ? "text-danger" : ""}`}>
      {icon && <span className="flex w-6 shrink-0 justify-center">{icon}</span>}
      <span className="min-w-0"><span className="block text-[17px] leading-tight">{title}</span>{sub && <span className="mt-0.5 block text-[15px] leading-tight text-muted">{sub}</span>}</span>
    </button>
  );
}

/** The page you reach by tapping your profile picture (like Signal's Settings page). */
export function SettingsScreen() {
  const { me, closeModal, openModal, signOut } = useApp();
  const soon = (feature: string) => () => openModal({ type: "comingSoon", feature });
  const sw = 1.6;
  return (
    <Screen label="Settings" title="Settings" onBack={closeModal}>
      {me && (
        <button onClick={() => openModal({ type: "profile" })} aria-label="Edit your profile" className="flex w-full items-center gap-5 px-6 pb-6 pt-4 text-left hover:bg-hover">
          <Avatar name={me.display_name} color={me.avatar_color} url={me.avatar_url} size={80} />
          <span className="min-w-0"><span className="block truncate text-[24px] leading-tight">{me.display_name}</span>
            <span className="mt-0.5 block text-[16px] text-muted">{me.phone ?? `@${me.username}`}</span></span>
        </button>
      )}
      <Row icon={<CircleUserRound size={24} strokeWidth={sw} />} title="Account" onClick={soon("Account settings")} />
      <Row icon={<MonitorSmartphone size={24} strokeWidth={sw} />} title="Linked devices" onClick={soon("Linked devices")} />
      <Row icon={<Heart size={24} strokeWidth={sw} />} title="Donate to Signal" onClick={soon("Donations")} />
      <div className="my-2 h-[2px] bg-line" />
      <Row icon={<SunMedium size={24} strokeWidth={sw} />} title="Appearance" onClick={() => openModal({ type: "appearance" })} />
      <Row icon={<MessageCircle size={24} strokeWidth={sw} />} title="Chats" onClick={() => openModal({ type: "preferences" })} />
      <Row icon={<StoriesIcon size={24} bgVar="var(--c-chat)" />} title="Stories" onClick={soon("Story settings")} />
      <Row icon={<Bell size={24} strokeWidth={sw} />} title="Notifications" onClick={() => openModal({ type: "preferences" })} />
      <Row icon={<Lock size={24} strokeWidth={sw} />} title="Privacy" onClick={() => openModal({ type: "preferences" })} />
      <Row icon={<History size={24} strokeWidth={sw} />} title="Backups" onClick={soon("Backups")} />
      <Row icon={<ChartPie size={24} strokeWidth={sw} />} title="Data and storage" onClick={soon("Data and storage")} />
      <div className="my-2 h-[2px] bg-line" />
      <Row icon={<CircleHelp size={24} strokeWidth={sw} />} title="Help" onClick={soon("Help")} />
      <Row icon={<Mail size={24} strokeWidth={sw} />} title="Invite friends" onClick={soon("Invites")} />
      <Row icon={<LogOut size={24} strokeWidth={sw} />} title="Log out" danger onClick={() => { closeModal(); signOut(); }} />
      <div className="h-6" />
    </Screen>
  );
}

const THEMES: { v: ThemePref; label: string }[] = [{ v: "system", label: "System default" }, { v: "light", label: "Light" }, { v: "dark", label: "Dark" }];

/** Settings → Appearance. Theme opens a small System default / Light / Dark chooser. */
export function AppearanceScreen() {
  const { openModal, theme, setTheme } = useApp();
  const [picking, setPicking] = useState(false);
  const soon = (feature: string) => () => openModal({ type: "comingSoon", feature });
  const themeLabel = THEMES.find((t) => t.v === theme)?.label ?? "System default";
  return (
    <Screen label="Appearance" title="Appearance" onBack={() => openModal({ type: "settings" })}>
      <div className="pt-2">
        <Row title="Language" sub="System default" onClick={soon("Language")} />
        <Row title="Theme" sub={themeLabel} onClick={() => setPicking(true)} />
        <Row title="Chat color & wallpaper" onClick={soon("Chat colors and wallpapers")} />
        <Row title="App Icon" onClick={soon("App icons")} />
        <Row title="Message font size" sub="Normal" onClick={soon("Message font size")} />
        <Row title="Navigation bar size" sub="Normal" onClick={soon("Navigation bar size")} />
      </div>
      {picking && (
        <div className="anim-fade fixed inset-0 z-[60] flex items-center justify-center bg-[var(--c-overlay)] px-6" onMouseDown={(e) => { if (e.target === e.currentTarget) setPicking(false); }}>
          <div role="dialog" aria-label="Theme" aria-modal="true" className="anim-pop w-full max-w-[320px] rounded-[28px] bg-sheet px-6 pb-4 pt-6 shadow-[var(--c-shadow)]">
            <h3 className="mb-3 text-[22px]">Theme</h3>
            <div role="radiogroup" aria-label="Theme">
              {THEMES.map((t) => (
                <button key={t.v} role="radio" aria-checked={theme === t.v} onClick={() => { setTheme(t.v); setPicking(false); }} className="flex w-full items-center gap-4 py-3 text-left text-[17px]">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${theme === t.v ? "border-accent" : "border-muted"}`}>{theme === t.v && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}</span>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-end"><button onClick={() => setPicking(false)} className="rounded-full px-3 py-2 text-[16px] font-medium text-accent hover:bg-hover">Cancel</button></div>
          </div>
        </div>
      )}
    </Screen>
  );
}
