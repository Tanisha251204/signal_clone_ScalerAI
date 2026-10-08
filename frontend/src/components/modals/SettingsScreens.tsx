"use client";

import { useState, type ReactNode } from "react";
import { useApp } from "@/context/AppContext";
import type { ThemePref } from "@/lib/types";
import { ChevronRight } from "lucide-react";
import { Avatar, Screen } from "../ui";
import { AppearanceIcon, BackupIcon, BellIcon, ChatIcon, DataIcon, DevicesIcon, HeartIcon, HelpIcon, InviteIcon, LockIcon, PaymentIcon, PersonCircleIcon, StoriesIcon } from "../signalIcons";

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
  const { me, closeModal, openModal } = useApp();
  const soon = (feature: string) => () => openModal({ type: "comingSoon", feature });
  return (
    <Screen label="Settings" title="Settings" onBack={closeModal}>
      {me && (
        <button onClick={() => openModal({ type: "profile" })} aria-label="Edit your profile" className="flex w-full items-center gap-5 px-6 pb-6 pt-4 text-left hover:bg-hover">
          <Avatar name={me.display_name} color={me.avatar_color} url={me.avatar_url} size={80} />
          <span className="min-w-0"><span className="block truncate text-[24px] leading-tight">{me.display_name}</span>
            <span className="mt-0.5 block text-[16px] text-muted">{me.phone ?? `@${me.username}`}</span></span>
        </button>
      )}
      <Row icon={<PersonCircleIcon />} title="Account" onClick={() => openModal({ type: "account" })} />
      <Row icon={<DevicesIcon />} title="Linked devices" onClick={soon("Linked devices")} />
      <Row icon={<HeartIcon />} title="Donate to Signal" onClick={soon("Donations")} />
      <div className="my-2 h-[2px] bg-line" />
      <Row icon={<AppearanceIcon />} title="Appearance" onClick={() => openModal({ type: "appearance" })} />
      <Row icon={<ChatIcon />} title="Chats" onClick={() => openModal({ type: "preferences" })} />
      <Row icon={<StoriesIcon />} title="Stories" onClick={soon("Story settings")} />
      <Row icon={<BellIcon />} title="Notifications" onClick={() => openModal({ type: "preferences" })} />
      <Row icon={<LockIcon />} title="Privacy" onClick={() => openModal({ type: "preferences" })} />
      <Row icon={<BackupIcon />} title="Backups" onClick={soon("Backups")} />
      <Row icon={<DataIcon />} title="Data and storage" onClick={soon("Data and storage")} />
      <div className="my-2 h-[2px] bg-line" />
      <Row icon={<PaymentIcon />} title="Payments" onClick={soon("Payments")} />
      <div className="my-2 h-[2px] bg-line" />
      <Row icon={<HelpIcon />} title="Help" onClick={soon("Help")} />
      <Row icon={<InviteIcon />} title="Invite your friends" onClick={soon("Invites")} />
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

/* ───────── Settings → Account (PIN, phone number, delete account) ───────── */
function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${checked ? "bg-[#34c759]" : "bg-[#78788033] dark:bg-[#ffffff26]"}`}>
      <span className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-md transition-all ${checked ? "left-[22px]" : "left-[2px]"}`} />
    </button>
  );
}
const Heading = ({ children }: { children: ReactNode }) => <h3 className="px-6 pb-2 pt-5 text-[17px] font-semibold">{children}</h3>;
const Card = ({ children }: { children: ReactNode }) => <div className="mx-4 divide-y divide-line overflow-hidden rounded-xl bg-field">{children}</div>;
const Note = ({ children }: { children: ReactNode }) => <p className="px-6 pb-1 pt-2.5 text-[12.5px] leading-[1.45] text-muted">{children}</p>;
function CardRow({ title, onClick, right, danger }: { title: string; onClick?: () => void; right?: ReactNode; danger?: boolean }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={`flex min-h-[46px] w-full items-center justify-between gap-3 px-4 py-2 text-left text-[16px] ${onClick ? "hover:bg-hover" : ""} ${danger ? "text-danger" : ""}`}>
      <span>{title}</span>{right ?? (onClick ? <ChevronRight size={18} className="text-muted" /> : null)}
    </Tag>
  );
}

export function AccountScreen() {
  const { me, openModal, prefs, setPref, signOut, closeModal, toast } = useApp();
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState("");
  const soon = (feature: string) => () => openModal({ type: "comingSoon", feature });
  const ident = me?.phone ?? me?.username ?? "";
  const digits = (v: string) => v.replace(/\D/g, "");
  const matches = !!typed.trim() && (digits(ident) ? digits(typed) === digits(ident) : typed.trim().replace(/^@/, "") === ident);
  return (
    <Screen label="Account" title="Account" onBack={() => openModal({ type: "settings" })}>
      <Heading>Signal PIN</Heading>
      <Card>
        <CardRow title="Change your PIN" onClick={soon("Changing your PIN")} />
        <CardRow title="PIN Reminders" right={<Switch label="PIN Reminders" checked={prefs.pinReminders} onChange={(v) => setPref("pinReminders", v)} />} />
      </Card>
      <Note>PINs keep information stored with Signal encrypted so only you can access it. Your profile, settings, and contacts will restore when you reinstall Signal. <button onClick={soon("Learn more about PINs")} className="font-medium text-fg">Learn More</button></Note>
      <div className="mt-4" />
      <Card><CardRow title="Registration Lock" right={<Switch label="Registration Lock" checked={prefs.registrationLock} onChange={(v) => setPref("registrationLock", v)} />} /></Card>
      <Note>Require your Signal PIN to register your phone number again with Signal.</Note>
      <div className="mt-4" />
      <Card><CardRow title="Advanced PIN Settings" onClick={soon("Advanced PIN settings")} /></Card>

      <Heading>Account</Heading>
      <Card>
        <CardRow title="Change Phone Number" onClick={soon("Changing your phone number")} />
        <CardRow title="Your Account Data" onClick={soon("Your account data")} />
        <CardRow title="Delete Account" danger onClick={() => { setTyped(""); setDeleting(true); }} />
      </Card>
      <div className="h-10" />

      {deleting && (
        <div className="anim-fade fixed inset-0 z-[60] flex items-center justify-center bg-[var(--c-overlay)] px-6" onMouseDown={(e) => { if (e.target === e.currentTarget) setDeleting(false); }}>
          <div role="dialog" aria-modal="true" aria-label="Delete account" className="anim-pop w-full max-w-[340px] rounded-[28px] bg-sheet px-6 pb-4 pt-6 shadow-[var(--c-shadow)]">
            <h3 className="text-[22px]">Delete Account</h3>
            <p className="mt-3 text-[15px] leading-snug text-muted">You will be logged out of this device. To confirm, enter your {me?.phone ? "phone number" : "username"} ({ident}).</p>
            <p className="mt-2 text-[13px] leading-snug text-muted">Demo note: your data stays on the server so you can sign back in.</p>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Confirm phone number or username" autoFocus
              className="mt-4 h-11 w-full rounded-xl bg-field px-4 text-[16px] outline-none ring-accent focus:ring-2" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeleting(false)} className="rounded-full px-4 py-2 text-[16px] font-medium text-accent hover:bg-hover">Cancel</button>
              <button disabled={!matches} onClick={() => { setDeleting(false); closeModal(); signOut(); toast({ kind: "info", title: "Account deleted", body: "You have been logged out." }); }}
                className="rounded-full px-4 py-2 text-[16px] font-medium text-danger hover:bg-hover disabled:opacity-40">Delete</button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
