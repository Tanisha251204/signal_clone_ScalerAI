"use client";

import { useEffect } from "react";

/** Android-style single-choice dialog (title, radio rows, Cancel). Scrolls when the list is long. */
export function RadioDialog<T extends string>({ title, options, value, onPick, onClose }: {
  title: string; options: { value: T; label: string }[]; value: T; onPick: (v: T) => void; onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return (
    <div className="anim-fade fixed inset-0 z-[60] flex items-center justify-center bg-[var(--c-overlay)] px-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-label={title} aria-modal="true" className="anim-pop flex max-h-[min(86vh,720px)] w-full max-w-[340px] flex-col rounded-[28px] bg-sheet pb-3 pt-6 shadow-[var(--c-shadow)]">
        <h3 className="px-6 pb-2 text-[22px]">{title}</h3>
        <div role="radiogroup" aria-label={title} className="min-h-0 flex-1 overflow-y-auto px-6">
          {options.map((o) => (
            <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onPick(o.value)} className="flex w-full items-center gap-4 py-3 text-left text-[17px]">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${value === o.value ? "border-accent" : "border-muted"}`}>{value === o.value && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}</span>
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex justify-end px-4 pt-2"><button onClick={onClose} className="rounded-full px-3 py-2 text-[16px] font-medium text-accent hover:bg-hover">Cancel</button></div>
      </div>
    </div>
  );
}
