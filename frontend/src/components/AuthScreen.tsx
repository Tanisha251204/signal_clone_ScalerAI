"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { OTP_HINT } from "@/lib/config";
import { useApp } from "@/context/AppContext";
import { CodeStep, PermissionsStep, PhoneStep, PinStep, ProfileStep, WelcomeStep } from "./onboarding/Steps";

type Step = "welcome" | "permissions" | "phone" | "code" | "pin" | "profile";

/** Signal-style onboarding: welcome → permissions → phone → code → (new users: PIN → profile) → app. */
export function AuthScreen() {
  const { signIn, toast } = useApp();
  const [step, setStep] = useState<Step>("welcome");
  const [identifier, setIdentifier] = useState("");
  const [exists, setExists] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState<{ display_name: string; phone: string; avatar_color: string }[]>([]);

  useEffect(() => { api.demoUsers().then(setDemo).catch(() => {}); }, []);

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : "Something went wrong");

  async function requestCode(value: string) {
    setBusy(true); setError("");
    try {
      const r = await api.requestOtp(value);
      setIdentifier(r.identifier); setExists(r.exists); setStep("code");
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function verify(entered: string) {
    if (exists) {
      const r = await api.login(identifier, entered); // throws ApiError("Incorrect verification code") on mismatch
      signIn(r.token, r.user);
      return;
    }
    if (entered !== OTP_HINT) throw new ApiError(400, "Incorrect verification code");
    setCode(entered);
    setStep("pin");
  }

  async function finish(p: { first: string; last: string; color: string }) {
    setBusy(true); setError("");
    try {
      const r = await api.register({ identifier, otp: code, display_name: `${p.first} ${p.last}`.trim(), avatar_color: p.color });
      signIn(r.token, r.user);
      toast({ kind: "success", title: `Welcome, ${r.user.display_name}!` });
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  function askNotifications() { // fire-and-forget: the browser prompt must never block onboarding
    try { if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission().catch(() => {}); } catch { /* optional */ }
    setStep("phone");
  }

  switch (step) {
    case "welcome":
      return <WelcomeStep onContinue={() => setStep("permissions")} onRestore={() => toast({ kind: "info", title: "Not available in this demo", body: "Restore and transfer are placeholders." })} />;
    case "permissions":
      return <PermissionsStep onNext={askNotifications} onSkip={() => setStep("phone")} />;
    case "phone":
      return <PhoneStep demo={demo} busy={busy} error={error} onBack={() => { setError(""); setStep("permissions"); }} onSubmit={requestCode} onDemo={requestCode} />;
    case "code":
      return <CodeStep identifier={identifier} exists={exists} onWrongNumber={() => { setError(""); setStep("phone"); }} onVerify={verify}
        onResend={() => toast({ kind: "info", title: "Code sent", body: `Demo mode: the code is ${OTP_HINT}.` })} />;
    case "pin":
      return <PinStep onBack={() => setStep("code")} onNext={() => setStep("profile")} />;
    case "profile":
      return <ProfileStep busy={busy} error={error} onBack={() => setStep("pin")} onFinish={finish} />;
  }
}
