"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { MAX_TIMER, TIMER_OPTIONS, TIMER_UNITS, splitTimer, timerLabel } from "@/lib/format";
import { Button, Screen } from "../ui";

type Choice = number | null | "custom";

/** Disappearing-messages picker: radio list (Off … 30 seconds, Custom time) with a Save button, like Signal. */
export function DisappearingModal({ conversationId }: { conversationId: number }) {
  const { conversations, closeModal, openModal, upsertConversation, toast } = useApp();
  const conv = conversations.find((c) => c.id === conversationId);
  const current = conv?.disappear_after ?? null;
  const isPreset = TIMER_OPTIONS.some((o) => o.value === current);
  const init = current !== null && !isPreset ? splitTimer(current) : { amount: 1, size: 3600 };
  const [choice, setChoice] = useState<Choice>(current === null ? null : isPreset ? current : "custom");
  const [amount, setAmount] = useState(String(init.amount));
  const [unit, setUnit] = useState(init.size);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!conv) closeModal(); }, [conv, closeModal]);
  if (!conv) return null;

  const back = () => openModal({ type: "chatSettings", conversationId: conv.id });
  const canEdit = conv.type !== "group" || conv.my_role === "admin";
  const n = Number(amount);
  const customSecs = Number.isInteger(n) && n >= 1 ? n * unit : NaN;
  const customOk = Number.isFinite(customSecs) && customSecs <= MAX_TIMER;
  const value = choice === "custom" ? customSecs : choice;
  const valid = choice !== "custom" || customOk;

  async function save() {
    if (!conv) return;
    if (value === current) return back();
    setSaving(true);
    try {
      upsertConversation(await api.updateConversation(conv.id, value === null ? { clear_disappear: true } : { disappear_after: value as number }));
      toast({ kind: "success", title: value === null ? "Disappearing messages turned off" : `Messages will disappear after ${timerLabel(value as number)}` });
      back();
    } catch (e) { toast({ kind: "error", title: "Couldn't change the timer", body: e instanceof ApiError ? e.message : undefined }); }
    finally { setSaving(false); }
  }

  const options: { key: string; label: string; value: Choice }[] = [
    ...TIMER_OPTIONS.map((o) => ({ key: String(o.value), label: o.label, value: o.value as Choice })),
    { key: "custom", label: "Custom time", value: "custom" },
  ];
  return (
    <Screen label="Disappearing messages" title="Disappearing messages" onBack={back}
      footer={<div className="flex justify-end px-5 pb-6 pt-3"><Button variant="tonal" onClick={save} loading={saving} disabled={!canEdit || !valid} className="h-12 min-w-[104px] text-[16px]">Save</Button></div>}>
      <p className="px-6 pb-4 pt-3 text-[16px] leading-snug text-muted">
        {canEdit ? "When enabled, new messages sent and received in this chat will disappear after they have been seen." : "Only group admins can change this setting."}
      </p>
      <div role="radiogroup" aria-label="Disappear after" className="pb-2">
        {options.map((o) => {
          const on = choice === o.value;
          return (
            <button key={o.key} role="radio" aria-checked={on} disabled={!canEdit} onClick={() => setChoice(o.value)}
              className="flex w-full items-center gap-5 px-6 py-[15px] text-left transition hover:bg-hover disabled:opacity-60">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-accent" : "border-muted"}`}>{on && <span className="h-3 w-3 rounded-full bg-accent" />}</span>
              <span className="text-[18px]">{o.label}</span>
            </button>
          );
        })}
      </div>
      {choice === "custom" && (
        <div className="flex items-center gap-3 px-6 pb-4 pl-[68px]">
          <input aria-label="Custom amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 7))}
            className="h-11 w-24 rounded-xl bg-field px-3 text-[17px] outline-none focus:ring-2 focus:ring-accent" />
          <select aria-label="Custom unit" value={unit} onChange={(e) => setUnit(Number(e.target.value))} className="h-11 rounded-xl bg-field px-3 text-[17px] outline-none focus:ring-2 focus:ring-accent">
            {TIMER_UNITS.map((u) => <option key={u.label} value={u.size}>{u.label}</option>)}
          </select>
          {!customOk && amount !== "" && <span role="alert" className="text-sm text-danger">1 second to 4 weeks</span>}
        </div>
      )}
    </Screen>
  );
}
