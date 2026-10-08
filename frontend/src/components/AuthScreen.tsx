"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Lock, MessageCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { OTP_HINT } from "@/lib/config";
import { useApp } from "@/context/AppContext";
import { Avatar, Button, Spinner } from "./ui";

type Step = "identifier" | "otp" | "profile";
const COLORS = ["#2C6BED", "#E0457B", "#1B998B", "#8E44AD", "#F29D38", "#D64545", "#3D5A80", "#5B8C5A"];

export function AuthScreen() {
  const { signIn, toast } = useApp();
  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [normalized, setNormalized] = useState("");
  const [exists, setExists] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState<{ display_name: string; phone: string; avatar_color: string }[]>([]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const otpVals = useRef<string[]>(["", "", "", "", "", ""]); // latest digits, immune to stale closures (fast typing / autofill)
  const setDigits = (arr: string[]) => { otpVals.current = arr; setOtp(arr); };

  useEffect(() => { api.demoUsers().then(setDemo).catch(() => {}); }, []);
  useEffect(() => { if (step === "otp") otpRefs.current[0]?.focus(); }, [step]); // deterministic focus (no timer race with fast typing)

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : "Something went wrong");

  async function submitIdentifier(e?: React.FormEvent, value = identifier) {
    e?.preventDefault();
    if (!value.trim()) return setError("Enter your phone number or username");
    setBusy(true); setError("");
    try {
      const r = await api.requestOtp(value);
      setNormalized(r.identifier); setExists(r.exists); setStep("otp");
    } catch (err) { fail(err); } finally { setBusy(false); }
  }

  async function verify(code: string) {
    setBusy(true); setError("");
    try {
      if (exists) {
        const r = await api.login(normalized, code);
        signIn(r.token, r.user);
      } else {
        if (code !== OTP_HINT) throw new ApiError(400, "Incorrect verification code");
        setStep("profile");
      }
    } catch (err) {
      fail(err); setDigits(["", "", "", "", "", ""]); otpRefs.current[0]?.focus();
    } finally { setBusy(false); }
  }

  function onOtpChange(i: number, v: string) {
    const d = v.replace(/\D/g, "");
    if (d.length > 1) { // paste
      const next = d.slice(0, 6).split("");
      const arr = [...next, ...Array(6 - next.length).fill("")];
      setDigits(arr);
      otpRefs.current[Math.min(next.length, 5)]?.focus();
      if (next.length === 6) verify(next.join(""));
      return;
    }
    const arr = [...otpVals.current]; arr[i] = d; setDigits(arr);
    if (d && i < 5) otpRefs.current[i + 1]?.focus();
    if (arr.every(Boolean)) verify(arr.join(""));
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Please enter your name");
    setBusy(true); setError("");
    try {
      const r = await api.register({ identifier: normalized, otp: otp.join(""), display_name: name.trim(), avatar_color: color });
      signIn(r.token, r.user);
      toast({ kind: "success", title: `Welcome, ${r.user.display_name}!` });
    } catch (err) { fail(err); } finally { setBusy(false); }
  }

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-bg p-4">
      <div className="anim-pop w-full max-w-[420px] py-6">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-outb text-white shadow-lg">
            <MessageCircle size={34} fill="currentColor" strokeWidth={1.5} />
          </div>
          <h1 className="text-[26px] font-bold tracking-tight">Signal</h1>
          <p className="mt-1 text-sm text-muted">Speak freely. Say &ldquo;hello&rdquo; to privacy.</p>
        </div>

        {step !== "identifier" && (
          <button className="mb-3 flex items-center gap-1 text-sm text-accent" onClick={() => { setStep(step === "profile" ? "otp" : "identifier"); setError(""); }}>
            <ArrowLeft size={16} /> Back
          </button>
        )}

        {step === "identifier" && (
          <form onSubmit={submitIdentifier} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Your phone number or username</h2>
              <p className="mt-1 text-sm text-muted">Include your country code, e.g. +91 98100 00001. New here? We&apos;ll create your account in the next step.</p>
            </div>
            <input autoFocus value={identifier} onChange={(e) => { setIdentifier(e.target.value); setError(""); }} inputMode="tel"
              placeholder="+91 98100 00001  or  username" aria-label="Phone number or username"
              className="h-12 w-full rounded-xl border border-line bg-field px-4 text-[15px] outline-none focus:border-accent" />
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button type="submit" loading={busy} className="h-12 w-full">Next</Button>

            {demo.length > 0 && (
              <div className="pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Demo accounts · tap to sign in (code {OTP_HINT})</p>
                <div className="grid grid-cols-2 gap-2">
                  {demo.slice(0, 6).map((d) => (
                    <button type="button" key={d.phone} onClick={() => { setIdentifier(d.phone); submitIdentifier(undefined, d.phone); }}
                      className="flex items-center gap-2 rounded-xl border border-line p-2 text-left transition hover:bg-hover">
                      <Avatar name={d.display_name} color={d.avatar_color} size={32} />
                      <span className="min-w-0"><span className="block truncate text-[13px] font-medium">{d.display_name}</span>
                        <span className="block truncate text-[11px] text-muted">{d.phone}</span></span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}

        {step === "otp" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Enter your verification code</h2>
              <p className="mt-1 text-sm text-muted">We sent a code to <b className="text-fg">{normalized}</b>. <span className="text-accent">Demo mode: the code is {OTP_HINT}.</span></p>
            </div>
            <div className="flex justify-between gap-2">
              {otp.map((d, i) => (
                <input key={i} ref={(el) => { otpRefs.current[i] = el; }} value={d} inputMode="numeric" maxLength={6} aria-label={`Digit ${i + 1}`}
                  onChange={(e) => onOtpChange(i, e.target.value)} disabled={busy}
                  onKeyDown={(e) => { if (e.key === "Backspace" && !otpVals.current[i] && i > 0) otpRefs.current[i - 1]?.focus(); }}
                  className="h-14 w-full rounded-xl border border-line bg-field text-center text-xl font-semibold outline-none focus:border-accent" />
              ))}
            </div>
            {busy && <div className="flex justify-center"><Spinner /></div>}
            {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}
            <p className="text-center text-xs text-muted">{exists ? "Welcome back — enter the code to sign in." : "New number — you'll set up your profile next."}</p>
          </div>
        )}

        {step === "profile" && (
          <form onSubmit={register} className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Set up your profile</h2>
              <p className="mt-1 text-sm text-muted">Your name and avatar are visible to people you message. You can add a photo later in your profile.</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Avatar name={name || "?"} color={color} size={92} />
              <div className="flex gap-2" role="radiogroup" aria-label="Avatar colour">
                {COLORS.map((c) => (
                  <button type="button" key={c} role="radio" aria-checked={color === c} aria-label={`Colour ${c}`} onClick={() => { setColor(c); }}
                    className={`h-6 w-6 rounded-full transition ${color === c ? "ring-2 ring-offset-2 ring-offset-[var(--c-bg)]" : ""}`} style={{ background: c, ["--tw-ring-color" as string]: c }} />
                ))}
              </div>
            </div>
            <input autoFocus value={name} onChange={(e) => { setName(e.target.value); setError(""); }} maxLength={64} placeholder="Your name" aria-label="Display name"
              className="h-12 w-full rounded-xl border border-line bg-field px-4 text-[15px] outline-none focus:border-accent" />
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button type="submit" loading={busy} className="h-12 w-full">Finish</Button>
          </form>
        )}

        <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted"><Lock size={12} /> Messages are end-to-end encrypted (simulated for this demo)</p>
      </div>
    </div>
  );
}
