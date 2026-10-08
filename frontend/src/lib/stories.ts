/** Demo stories (placeholder content, like the rest of the demo data) and the "already viewed" bookkeeping. */
export interface Story { id: string; author: string; color: string; text: string; bg: string; ago: string }

export const DEMO_STORIES: Story[] = [
  { id: "demo-trek", author: "Priya Patel", color: "#E0457B", text: "Trek is on for Saturday 🏔️\nMeet at 6 am!", bg: "linear-gradient(160deg,#2c6bed 0%,#8e44ad 100%)", ago: "2 h ago" },
];

const KEY = "signal.storiesSeen";
export function loadSeen(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function saveSeen(ids: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* storage unavailable: viewed state just won't persist */ }
}
