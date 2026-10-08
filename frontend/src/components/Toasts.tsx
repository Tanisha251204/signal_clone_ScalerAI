"use client";

import { X, CheckCircle2, AlertCircle, Info, MessageCircle } from "lucide-react";
import { useApp } from "@/context/AppContext";

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[60] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => {
        const Icon = t.kind === "error" ? AlertCircle : t.kind === "success" ? CheckCircle2 : t.kind === "message" ? MessageCircle : Info;
        const color = t.kind === "error" ? "text-danger" : t.kind === "success" ? "text-[#3ba55d]" : "text-accent";
        return (
          <div key={t.id} role="status"
            className={`anim-pop pointer-events-auto flex items-start gap-3 rounded-2xl border border-line bg-bg px-4 py-3 shadow-[var(--c-shadow)] ${t.onClick ? "cursor-pointer hover:bg-hover" : ""}`}
            onClick={() => { t.onClick?.(); dismissToast(t.id); }}>
            <Icon size={20} className={`mt-0.5 shrink-0 ${color}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{t.title}</p>
              {t.body && <p className="line-clamp-2 text-[13px] text-muted">{t.body}</p>}
            </div>
            <button aria-label="Dismiss" className="text-muted hover:text-fg" onClick={(e) => { e.stopPropagation(); dismissToast(t.id); }}><X size={16} /></button>
          </div>
        );
      })}
    </div>
  );
}
