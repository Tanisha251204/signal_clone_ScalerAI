const parse = (iso: string) => new Date(iso);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export const timeOnly = (iso: string) => parse(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function listTime(iso: string): string {
  const d = parse(iso), now = new Date();
  if (sameDay(d, now)) return timeOnly(iso);
  const diffDays = Math.floor((+new Date(now.toDateString()) - +new Date(d.toDateString())) / 864e5);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function dayLabel(iso: string): string {
  const d = parse(iso), now = new Date();
  if (sameDay(d, now)) return "Today";
  const diffDays = Math.floor((+new Date(now.toDateString()) - +new Date(d.toDateString())) / 864e5);
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}

export function lastSeen(iso: string | null): string {
  if (!iso) return "Offline";
  const d = parse(iso), mins = Math.floor((Date.now() - +d) / 60000);
  if (mins < 1) return "last seen just now";
  if (mins < 60) return `last seen ${mins} min ago`;
  if (sameDay(d, new Date())) return `last seen today at ${timeOnly(iso)}`;
  return `last seen ${listTime(iso).toLowerCase()}`;
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => [...p][0]?.toUpperCase()).join("") || "?";

export function fileSize(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

/** Disappearing-message presets, in the order the Signal screen lists them (null = off). */
export const TIMER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Off" },
  { value: 2419200, label: "4 weeks" },
  { value: 604800, label: "1 week" },
  { value: 86400, label: "1 day" },
  { value: 28800, label: "8 hours" },
  { value: 3600, label: "1 hour" },
  { value: 300, label: "5 minutes" },
  { value: 30, label: "30 seconds" },
];
export const MAX_TIMER = 2419200; // 4 weeks (the server enforces the same limit)
export const TIMER_UNITS = [
  { label: "seconds", size: 1 }, { label: "minutes", size: 60 }, { label: "hours", size: 3600 }, { label: "days", size: 86400 }, { label: "weeks", size: 604800 },
] as const;
/** Largest unit that divides the value evenly, e.g. 90 -> {amount: 90, size: 1}, 7200 -> {amount: 2, size: 3600}. */
export function splitTimer(secs: number) {
  const u = [...TIMER_UNITS].reverse().find((x) => secs % x.size === 0) ?? TIMER_UNITS[0];
  return { amount: secs / u.size, size: u.size };
}
export function timerLabel(s: number | null) {
  if (s === null) return "Off";
  const preset = TIMER_OPTIONS.find((o) => o.value === s);
  if (preset) return preset.label;
  const { amount, size } = splitTimer(s);
  const unit = TIMER_UNITS.find((u) => u.size === size)!.label;
  return `${amount} ${amount === 1 ? unit.slice(0, -1) : unit}`;
}

export function previewOf(m: { body: string; is_deleted: boolean; attachment: { type: string | null } | null; kind: string }): string {
  if (m.is_deleted) return "This message was deleted";
  if (m.attachment && !m.body) return m.attachment.type?.startsWith("image/") ? "📷 Photo" : "📎 Attachment";
  return m.body;
}
