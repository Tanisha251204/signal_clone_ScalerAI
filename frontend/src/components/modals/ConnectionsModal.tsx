"use client";

import { useApp } from "@/context/AppContext";
import { Modal } from "../ui";

/** Explains what a "connection" is (opened from the "Name not verified" pill on a contact card). */
export function ConnectionsModal() {
  const { closeModal } = useApp();
  const bullets = ["Starting a chat", "Accepting a message request", "Having them in your phone contacts"];
  return (
    <Modal title="Connections" onClose={closeModal}>
      <div className="px-6 pb-8 pt-2 text-[15px] leading-snug">
        <svg viewBox="0 0 60 60" width="64" height="64" className="mx-auto mb-5 text-accent" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i * Math.PI) / 3;
            return <circle key={i} cx={30 + 17 * Math.cos(a)} cy={30 + 17 * Math.sin(a)} r="8" fill="none" stroke="currentColor" strokeWidth="2.4" />;
          })}
        </svg>
        <p className="font-medium">Connections are people you&apos;ve chosen to trust, by:</p>
        <ul className="my-4 space-y-3">
          {bullets.map((b) => <li key={b} className="flex items-center gap-3 font-medium"><span className="h-5 w-1 rounded-full bg-muted/60" />{b}</li>)}
        </ul>
        <p className="text-muted">Your connections can see your name and photo. &ldquo;Name not verified&rdquo; means this person isn&apos;t in your saved contacts yet, so the name they chose is shown as-is.</p>
      </div>
    </Modal>
  );
}
