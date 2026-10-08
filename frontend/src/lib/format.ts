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

export const TIMER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Off" },
  { value: 30, label: "30 seconds" },
  { value: 300, label: "5 minutes" },
  { value: 3600, label: "1 hour" },
  { value: 28800, label: "8 hours" },
  { value: 86400, label: "1 day" },
  { value: 604800, label: "1 week" },
];
export const timerLabel = (s: number | null) => TIMER_OPTIONS.find((o) => o.value === s)?.label ?? `${s}s`;

export function previewOf(m: { body: string; is_deleted: boolean; attachment: { type: string | null } | null; kind: string }): string {
  if (m.is_deleted) return "This message was deleted";
  if (m.attachment && !m.body) return m.attachment.type?.startsWith("image/") ? "📷 Photo" : "📎 Attachment";
  return m.body;
}
