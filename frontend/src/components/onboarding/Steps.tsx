"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Camera, ChevronDown, Keyboard, Loader2, Phone, UserRound, Users } from "lucide-react";
import { OTP_HINT } from "@/lib/config";
import { Avatar, Button } from "../ui";

export const COLORS = ["#2C6BED", "#E0457B", "#1B998B", "#8E44AD", "#F29D38", "#D64545", "#3D5A80", "#5B8C5A"];
export const COUNTRIES = [
  { code: "+91", name: "India" }, { code: "+1", name: "US / Canada" }, { code: "+44", name: "UK" },
  { code: "+61", name: "Australia" }, { code: "+971", name: "UAE" }, { code: "+65", name: "Singapore" },
];

/** Shared screen frame: back arrow, large title, supporting text, content, footer actions. */
export function Frame({ onBack, title, subtitle, children, footer }: {
  onBack?: () => void; title: string; subtitle?: ReactNode; children?: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="flex h-full w-full justify-center overflow-y-auto bg-bg">
      <div className="anim-fade flex min-h-full w-full max-w-[440px] flex-col px-6 pb-6 pt-3">
        <div className="h-11">
          {onBack && <button aria-label="Back" onClick={onBack} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-fg hover:bg-hover"><ArrowLeft size={24} /></button>}
        </div>
        <h1 className="mt-3 text-[26px] font-medium leading-tight">{title}</h1>
        {subtitle && <div className="mt-3 text-[15px] leading-snug text-muted">{subtitle}</div>}
        <div className="mt-7 flex-1">{children}</div>
        {footer && <div className="mt-6 flex items-center justify-between gap-3">{footer}</div>}
      </div>
    </div>
  );
}

const nextBtn = (onClick: () => void, disabled = false, label = "Next", loading = false) => (
  <Button variant="tonal" onClick={onClick} disabled={disabled} loading={loading} className="h-11 min-w-[96px]">{label}</Button>
);

export function WelcomeStep({ onContinue, onRestore, onTerms }: { onContinue: () => void; onRestore: () => void; onTerms: () => void }) {
  return (
    <div className="flex h-full w-full justify-center overflow-y-auto bg-bg">
      <div className="anim-fade flex min-h-full w-full max-w-[440px] flex-col items-center px-6 pb-8 pt-8 text-center">
        <div className="flex flex-1 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/welcome.webp" alt="" width={420} height={540} className="h-auto w-[min(72vw,300px)] select-none" draggable={false} />
        </div>
        <h1 className="mt-6 text-[26px] font-bold leading-[1.25]">Take privacy with you.<br />Be yourself in every message.</h1>
        <p className="mt-9 text-[14px] font-semibold leading-snug text-fg/90">Demo build · not affiliated with Signal<br />
          <button onClick={onTerms} className="font-semibold hover:underline">Terms &amp; Privacy Policy</button></p>
        <div className="mt-8 flex w-full flex-col gap-3">
          <Button variant="tonal" onClick={onContinue} className="h-12 w-full text-[15px]">Continue</Button>
          <Button variant="tonal2" onClick={onRestore} className="h-12 w-full text-[15px]">Restore or transfer</Button>
        </div>
      </div>
    </div>
  );
}

/** Real-Signal permission glyphs: pale-yellow bell with ringing arcs, and a white contact circle with a blue-grey outline. */
function BellIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <g stroke="#c4b66b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13.2 14.6q-1.6 2.2-1.6 5M10.4 12.4q-2.7 3.3-2.7 7.6" />
        <path d="M26.8 14.6q1.6 2.2 1.6 5M29.6 12.4q2.7 3.3 2.7 7.6" />
        <path d="M20 9.2c-4.3 0-6.6 3.1-6.6 7.1v5.3c0 1.3-.6 2.4-1.7 3.2-.6.4-.4 1.3.4 1.3h16.4c.8 0 1-.9.4-1.3-1.1-.8-1.7-1.9-1.7-3.2v-5.3c0-4-2.3-7.1-6.6-7.1Z" fill="#fdf5c6" />
        <path d="M17.6 29.6q.4 2.2 2.4 2.2t2.4-2.2" fill="#fdf5c6" />
      </g>
    </svg>
  );
}
function ContactIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="14.5" fill="#ffffff" stroke="#8b9ac4" strokeWidth="1.8" />
      <circle cx="20" cy="16.2" r="4.6" stroke="#8b9ac4" strokeWidth="1.8" />
      <path d="M11.4 30.2c1.6-4 4.6-5.8 8.6-5.8s7 1.8 8.6 5.8" stroke="#8b9ac4" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PermissionsStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  // Plain coloured glyphs (no round tile), like the real permissions screen: yellow bell, outlined contact, outlined phone.
  const rows = [
    { icon: <BellIcon />, title: "Notifications", body: "Get notified when new messages arrive." },
    { icon: <ContactIcon />, title: "Contacts", body: "Find people you know. Your contacts stay private in this demo." },
    { icon: <Phone size={34} strokeWidth={1.6} stroke="#aebde8" fill="#cfd8f3" />, title: "Phone calls", body: "Make registering easier and enable additional calling features." },
  ];
  return (
    <Frame title="Allow permissions" subtitle="To help you message people you know, the app will request these permissions."
      footer={<div className="ml-auto flex items-center gap-3"><button onClick={onSkip} className="px-3 py-2 text-[15px] font-medium text-fg hover:opacity-80">Not now</button>{nextBtn(onNext)}</div>}>
      <ul className="space-y-6">
        {rows.map(({ icon, title, body }) => (
          <li key={title} className="flex items-start gap-4">
            <span aria-hidden="true" className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center">{icon}</span>
            <div><p className="text-[16px] font-medium">{title}</p><p className="mt-0.5 text-[14px] leading-snug text-muted">{body}</p></div>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

interface Demo { display_name: string; phone: string; avatar_color: string }

export function PhoneStep({ demo, busy, error, onBack, onSubmit, onDemo }: {
  demo: Demo[]; busy: boolean; error: string; onBack: () => void; onSubmit: (identifier: string) => void; onDemo: (phone: string) => void;
}) {
  const [cc, setCc] = useState("+91");
  const [number, setNumber] = useState("");
  const [username, setUsername] = useState("");
  const [useName, setUseName] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const digits = number.replace(/\D/g, "");
  const identifier = useName ? username.trim() : number.trim().startsWith("+") ? number.trim() : `${cc}${digits}`;
  const valid = useName ? username.trim().length >= 3 : digits.length >= 7;
  const pretty = useName ? `@${username.trim().replace(/^@/, "")}` : number.trim().startsWith("+") ? number.trim() : `${cc} ${digits}`;

  return (
    <Frame onBack={onBack} title={useName ? "Username" : "Phone number"}
      subtitle={useName ? "Sign in or sign up with a username (3–24 letters, digits, _ or .)." : "You will receive a verification code. Carrier rates may apply."}
      footer={<>
        <button onClick={() => setUseName((v) => !v)} className="flex items-center gap-2 px-1 py-2 text-[14px] font-medium text-accent"><Keyboard size={16} />{useName ? "Use phone number" : "Use a username"}</button>
        {nextBtn(() => setConfirm(true), !valid || busy, "Next", busy)}
      </>}>
      {useName ? (
        <label className="block rounded-t-lg border-b-2 border-accent bg-field px-4 pb-2 pt-2">
          <span className="block text-[12px] text-muted">Username</span>
          <input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} aria-label="Username" autoCapitalize="none"
            onKeyDown={(e) => { if (e.key === "Enter" && valid) setConfirm(true); }}
            className="w-full bg-transparent text-[17px] outline-none" />
        </label>
      ) : (
        <div className="flex gap-3">
          <label className="relative block w-[96px] shrink-0 rounded-t-lg border-b-2 border-line bg-field px-3 pb-2 pt-2">
            <span className="block text-[12px] text-muted">Code</span>
            <select value={cc} onChange={(e) => setCc(e.target.value)} aria-label="Country code" className="w-full appearance-none bg-transparent pr-5 text-[17px] outline-none">
              {COUNTRIES.map((c) => <option key={c.code} value={c.code} title={c.name} className="text-black">{c.code}</option>)}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-2 top-1/2 text-muted" />
          </label>
          <label className="block flex-1 rounded-t-lg border-b-2 border-accent bg-field px-4 pb-2 pt-2">
            <span className="block text-[12px] text-muted">Phone number</span>
            <input autoFocus value={number} onChange={(e) => setNumber(e.target.value)} inputMode="tel" aria-label="Phone number" placeholder="98100 00001"
              onKeyDown={(e) => { if (e.key === "Enter" && valid) setConfirm(true); }}
              className="w-full bg-transparent text-[17px] outline-none placeholder:text-muted/60" />
          </label>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}

      {demo.length > 0 && (
        <div className="mt-8">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Demo accounts · tap to sign in (code {OTP_HINT})</p>
          <div className="grid grid-cols-2 gap-2">
            {demo.slice(0, 6).map((d) => (
              <button type="button" key={d.phone} onClick={() => onDemo(d.phone)}
                className="flex items-center gap-2.5 rounded-2xl bg-btn2 p-2.5 text-left transition hover:brightness-110">
                <Avatar name={d.display_name} color={d.avatar_color} size={34} />
                <span className="min-w-0"><span className="block truncate text-[13.5px] font-medium text-btn2-fg">{d.display_name}</span>
                  <span className="block truncate text-[11px] text-muted">{d.phone}</span></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {confirm && (
        <div className="anim-fade fixed inset-0 z-50 flex items-center justify-center bg-[var(--c-overlay)] p-6" role="alertdialog" aria-modal="true" aria-label="Confirm number">
          <div className="anim-pop w-full max-w-[340px] rounded-[28px] bg-sheet p-6 shadow-[var(--c-shadow)]">
            <h2 className="text-[20px] font-medium leading-snug">{useName ? "Is the username below correct?" : "Is the phone number below correct?"}</h2>
            <p className="mt-4 text-[15px] font-medium">{pretty}</p>
            <p className="mt-3 text-[14px] leading-snug text-muted">No SMS is sent in this demo. Use the fixed code {OTP_HINT}.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setConfirm(false)} className="rounded-full px-4 py-2 text-[14px] font-medium text-accent hover:bg-hover">Edit number</button>
              <button onClick={() => { setConfirm(false); onSubmit(identifier); }} className="rounded-full px-4 py-2 text-[14px] font-medium text-accent hover:bg-hover">OK</button>
            </div>
          </div>
        </div>
      )}
    </Frame>
  );
}

export function CodeStep({ identifier, exists, onWrongNumber, onVerify, onResend }: {
  identifier: string; exists: boolean; onWrongNumber: () => void; onVerify: (code: string) => Promise<void>; onResend: () => void;
}) {
  const [digits, setDigitsState] = useState<string[]>(Array(6).fill(""));
  const vals = useRef<string[]>(Array(6).fill("")); // latest digits, immune to stale closures (fast typing / autofill)
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [left, setLeft] = useState(57);
  const setDigits = (a: string[]) => { vals.current = a; setDigitsState(a); };

  useEffect(() => { refs.current[0]?.focus(); }, []);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function submit(code: string) {
    setBusy(true); setError("");
    try { await onVerify(code); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); setDigits(Array(6).fill("")); refs.current[0]?.focus(); }
    finally { setBusy(false); }
  }
  function change(i: number, v: string) {
    const d = v.replace(/\D/g, "");
    if (d.length > 1) { // paste / autofill
      const next = d.slice(0, 6).split("");
      setDigits([...next, ...Array(6 - next.length).fill("")]);
      refs.current[Math.min(next.length, 5)]?.focus();
      if (next.length === 6) submit(next.join(""));
      return;
    }
    const a = [...vals.current]; a[i] = d; setDigits(a);
    if (d && i < 5) refs.current[i + 1]?.focus();
    if (a.every(Boolean)) submit(a.join(""));
  }
  const mmss = `00:${String(Math.max(left, 0)).padStart(2, "0")}`;
  const box = (i: number) => (
    <input key={i} ref={(el) => { refs.current[i] = el; }} value={digits[i]} inputMode="numeric" maxLength={6} aria-label={`Digit ${i + 1}`} disabled={busy}
      onChange={(e) => change(i, e.target.value)}
      onKeyDown={(e) => { if (e.key === "Backspace" && !vals.current[i] && i > 0) refs.current[i - 1]?.focus(); }}
      className="h-12 w-11 rounded-md bg-field text-center text-[19px] font-medium outline-none ring-accent focus:ring-2 sm:w-12" />
  );
  return (
    <Frame onBack={onWrongNumber} title="Verification code"
      subtitle={<>Enter the code we sent to <b className="font-medium text-fg">{identifier}</b></>}
      footer={<>
        <button disabled={left > 0} onClick={() => { setLeft(57); onResend(); }} className="text-[14px] font-medium text-accent disabled:text-muted">Resend Code {left > 0 && `(${mmss})`}</button>
        <button disabled={left > 0} onClick={() => { setLeft(57); onResend(); }} className="text-[14px] font-medium text-accent disabled:text-muted">Call me {left > 0 && `(${mmss})`}</button>
      </>}>
      <button onClick={onWrongNumber} className="text-[14px] font-medium text-accent">Wrong number?</button>
      <div className="mt-6 flex items-center justify-center gap-1.5">
        {[0, 1, 2].map(box)}<span className="px-1 text-xl text-muted">-</span>{[3, 4, 5].map(box)}
      </div>
      <div className="mt-6 flex h-6 justify-center">{busy && <Loader2 className="animate-spin text-accent" size={22} aria-label="Verifying" />}</div>
      {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}
      <p className="mt-4 text-center text-[13px] text-muted">{exists ? "Welcome back — enter the code to sign in." : "New number — you'll set up your profile next."} <span className="text-accent">Demo code: {OTP_HINT}</span></p>
    </Frame>
  );
}

export function PinStep({ onBack, onNext }: { onBack: () => void; onNext: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const [alpha, setAlpha] = useState(false);
  const ok = pin.length >= 4;
  return (
    <Frame onBack={onBack} title="Create your PIN"
      subtitle="PINs can help you restore your account if you lose your phone. (Demo: your PIN is not stored.)"
      footer={<><span />{nextBtn(() => onNext(pin), !ok)}</>}>
      <input autoFocus value={pin} onChange={(e) => setPin(alpha ? e.target.value : e.target.value.replace(/\D/g, ""))} inputMode={alpha ? "text" : "numeric"} type="password"
        aria-label="PIN" onKeyDown={(e) => { if (e.key === "Enter" && ok) onNext(pin); }}
        className="w-full rounded-t-lg border-b-2 border-accent bg-field px-4 py-3 text-[18px] tracking-widest outline-none" />
      <p className="mt-3 text-center text-[13px] text-muted">PIN must be at least 4 {alpha ? "characters" : "digits"}</p>
      <button onClick={() => { setAlpha((v) => !v); setPin(""); }} className="mx-auto mt-5 flex items-center gap-2 text-[14px] font-medium text-fg"><Keyboard size={16} /> Switch to {alpha ? "numeric" : "alphanumeric"}</button>
    </Frame>
  );
}

export function ProfileStep({ busy, error, onBack, onFinish }: {
  busy: boolean; error: string; onBack: () => void; onFinish: (p: { first: string; last: string; color: string }) => void;
}) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const ok = first.trim().length > 0;
  const submit = () => ok && onFinish({ first: first.trim(), last: last.trim(), color });
  const field = "block rounded-lg bg-field px-4 pb-2 pt-2 focus-within:ring-2 ring-accent";
  return (
    <Frame onBack={onBack} title="Set up your profile" subtitle={<>Profiles are visible to people you message, contacts and groups. <span className="text-accent">Learn more</span></>}
      footer={<><span />{nextBtn(submit, !ok || busy, "Next", busy)}</>}>
      <div className="flex justify-center">
        <button aria-label="Profile photo" onClick={() => setColor(COLORS[(COLORS.indexOf(color) + 1) % COLORS.length])} className="relative">
          {first.trim() ? <Avatar name={`${first} ${last}`.trim()} color={color} size={92} />
            : <span className="flex h-[92px] w-[92px] items-center justify-center rounded-full bg-[#f3ecfb]"><UserRound size={44} strokeWidth={1.5} className="text-[#7b4fd6]" /></span>}
          <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-btn2 text-btn2-fg"><Camera size={16} /></span>
        </button>
      </div>
      <div className="mt-6 space-y-3">
        <label className={field}><span className="block text-[12px] text-muted">First name (required)</span>
          <input autoFocus value={first} onChange={(e) => setFirst(e.target.value)} maxLength={30} aria-label="First name" onKeyDown={(e) => e.key === "Enter" && submit()} className="w-full bg-transparent text-[16px] outline-none" /></label>
        <label className={field}><span className="block text-[12px] text-muted">Last name (optional)</span>
          <input value={last} onChange={(e) => setLast(e.target.value)} maxLength={30} aria-label="Last name" onKeyDown={(e) => e.key === "Enter" && submit()} className="w-full bg-transparent text-[16px] outline-none" /></label>
      </div>
      <div className="mt-5 flex items-center gap-4 px-1">
        <Users size={20} className="text-muted" />
        <div><p className="text-[15px] font-medium">Who can find me by number?</p><p className="text-[13px] text-muted">Everyone</p></div>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    </Frame>
  );
}
