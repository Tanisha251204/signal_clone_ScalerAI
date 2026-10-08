"use client";

import { useEffect, type ReactNode } from "react";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { assetUrl } from "@/lib/api";
import { initials } from "@/lib/format";
import type { MsgStatus } from "@/lib/types";

export function Avatar({ name, color, url, size = 48, online, className = "" }: {
  name: string; color: string; url?: string | null; size?: number; online?: boolean; className?: string;
}) {
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assetUrl(url)} alt={name} className="h-full w-full rounded-full object-cover" />
      ) : (
        <div className="flex h-full w-full select-none items-center justify-center rounded-full font-semibold text-white"
          style={{ background: color, fontSize: size * 0.38 }} aria-label={name}>
          {initials(name)}
        </div>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 rounded-full border-2 border-sidebar bg-[#3ba55d]"
          style={{ width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26) }} title="Online" />
      )}
    </div>
  );
}

export function IconButton({ label, onClick, children, className = "", active, disabled }: {
  label: string; onClick?: () => void; children: ReactNode; className?: string; active?: boolean; disabled?: boolean;
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-hover hover:text-fg disabled:opacity-40 ${active ? "bg-hover text-fg" : ""} ${className}`}>
      {children}
    </button>
  );
}

export function Spinner({ size = 20, className = "" }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin text-accent ${className}`} aria-label="Loading" />;
}

export function Modal({ title, onClose, children, footer, wide }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-[var(--c-overlay)] sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`anim-slide sm:anim-pop flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-sheet shadow-[var(--c-shadow)] sm:rounded-2xl ${wide ? "sm:max-w-xl" : "sm:max-w-md"}`}>
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <IconButton label="Close" onClick={onClose}><X size={20} /></IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Button({ children, onClick, variant = "primary", disabled, loading, type = "button", className = "" }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger" | "tonal" | "tonal2"; disabled?: boolean; loading?: boolean; type?: "button" | "submit"; className?: string;
}) {
  const styles = {
    primary: "bg-outb text-white hover:brightness-110",
    ghost: "bg-field text-fg hover:bg-hover",
    tonal: "bg-btn text-btn-fg hover:brightness-110",
    tonal2: "bg-btn2 text-btn2-fg hover:brightness-110",
    danger: "bg-danger text-white hover:brightness-110",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition disabled:opacity-50 ${styles} ${className}`}>
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition ${checked ? "bg-outb" : "bg-[var(--c-line)]"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <AlertTriangle className="text-danger" size={30} />
      <p className="text-sm text-muted">{message}</p>
      {onRetry && <Button variant="ghost" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

/** Signal-style receipt: dashed circle (sending) → circle+check (sent) → two circles (delivered) → filled circles (read). */
export function ReceiptIcon({ status, className = "" }: { status: MsgStatus | null; className?: string }) {
  if (!status) return null;
  if (status === "failed") return <AlertTriangle size={13} className="text-danger" aria-label="Failed" />;
  const label = status[0].toUpperCase() + status.slice(1);
  const check = (cx: number, stroke: string) => <path d={`M${cx - 2.2} 6.2l1.6 1.6 2.9-3.3`} fill="none" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />;
  return (
    <svg width="19" height="12" viewBox="0 0 19 12" className={className} role="img" aria-label={label}>
      <title>{label}</title>
      {status === "sending" && <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />}
      {status === "sent" && (<><circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" />{check(6, "currentColor")}</>)}
      {status === "delivered" && (<>
        <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" />{check(6, "currentColor")}
        <circle cx="12" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" />{check(12, "currentColor")}
      </>)}
      {status === "read" && (<>
        <circle cx="6" cy="6" r="5.4" fill="currentColor" />{check(6, "var(--rc-bg, #2c6bed)")}
        <circle cx="12" cy="6" r="5.4" fill="currentColor" />{check(12, "var(--rc-bg, #2c6bed)")}
      </>)}
    </svg>
  );
}

export function TypingDots({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[3px] ${className}`} aria-label="typing">
      {[0, 1, 2].map((i) => <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-current" style={{ animationDelay: `${i * 0.16}s` }} />)}
    </span>
  );
}
