/**
 * Renders the REAL app (AppProvider + AppShell) against a RUNNING backend (default http://localhost:8000).
 * Verifies the UI <-> REST <-> WebSocket contract end to end: login, list, chat, send, realtime, typing, unread.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/AppShell";
import { AppProvider } from "@/context/AppContext";

const API = process.env.NEXT_PUBLIC_API_URL!;
const WS = API.replace(/^http/, "ws");

async function login(phone: string) {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: phone, otp: "123456" }) });
  return (await r.json()) as { token: string; user: { id: number } };
}
const authed = (token: string) => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });

function mount() {
  return render(<AppProvider><AppShell /></AppProvider>);
}
async function signInAs(name: RegExp) {
  const user = userEvent.setup();
  mount();
  await user.click(await screen.findByRole("button", { name }));      // pick demo account → OTP step
  await user.click(await screen.findByLabelText("Digit 1"));
  await user.keyboard("123456");                                         // mocked fixed OTP, auto-submits on 6th digit
  await screen.findByLabelText("Search conversations", {}, { timeout: 8000 });
  return user;
}

describe("Signal clone UI against live backend", () => {
  it("login screen → demo account → OTP → populated conversation list", async () => {
    await signInAs(/Aarav Sharma/);
    const items = await screen.findAllByTestId("conversation-item");
    expect(items.length).toBeGreaterThanOrEqual(7);
    expect(screen.getByText("Weekend Trek 🏔️")).toBeInTheDocument();
    // unread badge from seed data (Karan has 3 unread for Aarav)
    const karan = items.find((i) => within(i).queryByText("Karan Singh"));
    expect(within(karan!).getByTestId("unread-badge")).toHaveTextContent("3");
  });

  it("session persists across a reload (token in localStorage)", async () => {
    await signInAs(/Aarav Sharma/);
    expect(localStorage.getItem("signal.token")).toBeTruthy();
    document.body.innerHTML = "";
    mount(); // simulates refresh: new app instance, same localStorage
    expect(await screen.findByLabelText("Search conversations")).toBeInTheDocument();
  });

  it("opens a chat, sends a message, shows it with a receipt, and clears unread", async () => {
    const user = await signInAs(/Aarav Sharma/);
    const karan = (await screen.findAllByTestId("conversation-item")).find((i) => within(i).queryByText("Karan Singh"))!;
    await user.click(karan);
    expect(await screen.findByTestId("chat-title")).toHaveTextContent("Karan Singh");
    await screen.findByText(/websocket reconnect fix/i);
    await waitFor(() => expect(within(screen.getAllByTestId("conversation-item").find((i) => within(i).queryByText("Karan Singh"))!).queryByTestId("unread-badge")).toBeNull());

    const text = `ui-test-${Date.now()}`;
    await user.type(screen.getByTestId("composer"), `${text}{Enter}`);
    const list = screen.getByTestId("message-list");
    const bubble = await within(list).findByText(text); // the bubble, not the sidebar preview
    expect(bubble).toBeInTheDocument();
    // optimistic 'sending' resolves in place (same DOM node, no remount) to a server-confirmed receipt icon
    await waitFor(() => expect(within(bubble.closest("[data-testid=message]") as HTMLElement).getByRole("img", { name: /^(Sent|Delivered|Read)$/ })).toBeInTheDocument(), { timeout: 5000 });
    expect(bubble.isConnected).toBe(true); // proves the bubble wasn't unmounted/re-created on confirmation
  });

  it("receives a realtime message, typing indicator and read receipt from another user without refresh", async () => {
    const user = await signInAs(/Aarav Sharma/);
    const priyaRow = (await screen.findAllByTestId("conversation-item")).find((i) => within(i).queryByText("Priya Patel"))!;
    await user.click(priyaRow);
    await screen.findByTestId("chat-title");

    const priya = await login("+919810000002");
    const aarav = await login("+919810000001");
    const convs = await (await fetch(`${API}/api/conversations`, { headers: authed(priya.token) })).json();
    const cid = convs.find((c: { title: string }) => c.title === "Aarav Sharma").id;

    // Priya's second client: real WebSocket
    const ws = new WebSocket(`${WS}/ws?token=${priya.token}`);
    await new Promise((res) => { ws.onopen = () => res(null); });
    ws.send(JSON.stringify({ type: "typing", conversation_id: cid, is_typing: true }));
    await waitFor(() => expect(screen.getAllByText(/typing/i).length).toBeGreaterThan(0), { timeout: 5000 }); // header subtitle + list preview

    const body = `realtime-${Date.now()}`;
    await fetch(`${API}/api/conversations/${cid}/messages`, { method: "POST", headers: authed(priya.token), body: JSON.stringify({ body, client_id: body }) });
    expect((await screen.findAllByText(body, {}, { timeout: 5000 })).length).toBeGreaterThan(0); // bubble (+ sidebar preview) arrived over WS, no refresh

    // Aarav's open chat auto-marks it read → Priya's socket gets a read status event
    const got = await new Promise<boolean>((resolve) => {
      const t = setTimeout(() => resolve(false), 5000);
      ws.onmessage = (e) => { const ev = JSON.parse(e.data); if (ev.type === "message.status" && ev.updates.some((u: { status: string }) => u.status === "read")) { clearTimeout(t); resolve(true); } };
    });
    expect(got).toBe(true);
    ws.close();
    void aarav;
  });

  it("shows an unread badge + preview for a message arriving in a chat that isn't open", async () => {
    await signInAs(/Aarav Sharma/);
    await screen.findAllByTestId("conversation-item");
    const rohan = await login("+919810000003");
    const convs = await (await fetch(`${API}/api/conversations`, { headers: authed(rohan.token) })).json();
    const cid = convs.find((c: { title: string }) => c.title === "Aarav Sharma").id;
    const body = `background-${Date.now()}`;
    await fetch(`${API}/api/conversations/${cid}/messages`, { method: "POST", headers: authed(rohan.token), body: JSON.stringify({ body, client_id: body }) });
    const row = await waitFor(() => {
      const r = screen.getAllByTestId("conversation-item").find((i) => within(i).queryByText("Rohan Mehta"));
      expect(r).toBeTruthy(); expect(within(r!).getByText(body)).toBeInTheDocument();
      return r!;
    }, { timeout: 6000 });
    expect(within(row).getByTestId("unread-badge")).toBeInTheDocument();
    // conversation moved to the top (most recent activity)
    expect(screen.getAllByTestId("conversation-item")[0]).toBe(row);
  });

  it("filter chips narrow the list (Unread / Groups)", async () => {
    const user = await signInAs(/Aarav Sharma/);
    const total = (await screen.findAllByTestId("conversation-item")).length;
    await user.click(screen.getByRole("tab", { name: /Groups/ }));
    const groups = screen.getAllByTestId("conversation-item");
    expect(groups.length).toBe(3); // Weekend Trek, Project Falcon, Family
    await user.click(screen.getByRole("tab", { name: /Unread/ }));
    const unread = screen.getAllByTestId("conversation-item");
    expect(unread.length).toBeGreaterThan(0);
    expect(unread.length).toBeLessThan(total);
    unread.forEach((i) => expect(within(i).getByTestId("unread-badge")).toBeInTheDocument());
  });

  it("search finds conversations and message text; logout returns to the login screen", async () => {
    const user = await signInAs(/Aarav Sharma/);
    await user.type(screen.getByLabelText("Search conversations"), "trek");
    expect((await screen.findAllByText("Weekend Trek 🏔️")).length).toBeGreaterThan(0); // chat hit (+ message hits)
    await user.clear(screen.getByLabelText("Search conversations"));
    await user.click(screen.getByLabelText("Menu"));
    await user.click(await screen.findByRole("menuitem", { name: /Log out/ }));
    expect(await screen.findByText("Your phone number or username")).toBeInTheDocument();
    expect(localStorage.getItem("signal.token")).toBeNull();
  });
});
