"use client";

import { Bell, Keyboard, Link2, Lock, LogOut, Monitor, Moon, Palette, Smartphone, Sun } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { ThemePref } from "@/lib/types";
import { Button, Modal, Toggle } from "../ui";

const Section = ({ icon: Icon, title, children }: { icon: typeof Bell; title: string; children: React.ReactNode }) => (
  <section className="px-5 py-3">
    <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted"><Icon size={14} /> {title}</h3>
    <div className="divide-y divide-line">{children}</div>
  </section>
);
const Row = ({ title, desc, right }: { title: string; desc?: string; right: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="text-[15px] font-medium">{title}</p>{desc && <p className="text-[13px] text-muted">{desc}</p>}</div>{right}</div>
);
const Soon = () => <span className="rounded-full bg-field px-2.5 py-1 text-xs font-medium text-muted">Coming soon</span>;

const SHORTCUTS: [string, string][] = [["Ctrl/⌘ + K", "Search"], ["Alt + N", "New message"], ["Alt + G", "New group"], ["Alt + ↑ / ↓", "Previous / next chat"], ["Esc", "Close chat or dialog"], ["Enter", "Send message"], ["Shift + Enter", "New line"]];

export function SettingsModal() {
  const { closeModal, theme, setTheme, prefs, setPref, signOut, toast } = useApp();

  async function askNotifications(v: boolean) {
    setPref("notifications", v);
    if (v && "Notification" in window && Notification.permission === "default") {
      const p = await Notification.requestPermission();
      if (p === "denied") toast({ kind: "info", title: "Desktop notifications are blocked", body: "In-app notifications are still on." });
    }
  }

  const themes: { v: ThemePref; label: string; icon: typeof Sun }[] = [{ v: "system", label: "System", icon: Monitor }, { v: "light", label: "Light", icon: Sun }, { v: "dark", label: "Dark", icon: Moon }];
  return (
    <Modal title="Settings" onClose={closeModal} wide>
      <div className="divide-y divide-line pb-2">
        <Section icon={Palette} title="Appearance">
          <div className="grid grid-cols-3 gap-2 py-3" role="radiogroup" aria-label="Theme">
            {themes.map((t) => (
              <button key={t.v} role="radio" aria-checked={theme === t.v} onClick={() => setTheme(t.v)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-sm font-medium transition ${theme === t.v ? "border-accent bg-accent-soft text-accent" : "border-line hover:bg-hover"}`}>
                <t.icon size={20} />{t.label}</button>))}
          </div>
        </Section>
        <Section icon={Bell} title="Notifications">
          <Row title="Message notifications" desc="Show a notification when a message arrives in another chat" right={<Toggle label="Message notifications" checked={prefs.notifications} onChange={askNotifications} />} />
        </Section>
        <Section icon={Lock} title="Privacy">
          <Row title="Typing indicators" desc="Let people see when you're typing" right={<Toggle label="Typing indicators" checked={prefs.typingIndicators} onChange={(v) => setPref("typingIndicators", v)} />} />
          <Row title="Read receipts" desc="Preference saved (receipts are always on in this demo)" right={<Toggle label="Read receipts" checked={prefs.readReceipts} onChange={(v) => setPref("readReceipts", v)} />} />
          <Row title="Screen lock" desc="Require a passcode to open the app" right={<Soon />} />
          <Row title="Always relay calls" desc="Hide your IP address during calls" right={<Soon />} />
        </Section>
        <Section icon={Smartphone} title="Chats">
          <Row title="Enter key sends" desc="Turn off to send with Ctrl/⌘ + Enter" right={<Toggle label="Enter key sends" checked={prefs.enterToSend} onChange={(v) => setPref("enterToSend", v)} />} />
        </Section>
        <Section icon={Link2} title="Linked devices"><Row title="Link a new device" desc="Use Signal on your tablet or desktop" right={<Soon />} /></Section>
        <Section icon={Keyboard} title="Keyboard shortcuts">
          <div className="py-2">{SHORTCUTS.map(([k, d]) => <div key={k} className="flex items-center justify-between py-1.5 text-sm"><span className="text-muted">{d}</span><kbd className="rounded-md border border-line bg-field px-2 py-0.5 font-mono text-xs">{k}</kbd></div>)}</div>
        </Section>
        <section className="px-5 py-4">
          <Button variant="danger" onClick={() => { closeModal(); signOut(); }} className="w-full"><LogOut size={16} /> Log out</Button>
          <p className="mt-3 text-center text-xs text-muted">Signal-inspired demo · encryption is simulated</p>
        </section>
      </div>
    </Modal>
  );
}
