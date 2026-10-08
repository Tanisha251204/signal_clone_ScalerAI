/**
 * Renders the REAL app (AppProvider + AppShell) against a RUNNING backend (default http://localhost:8000).
 * Verifies the UI <-> REST <-> WebSocket contract end to end: login, list, chat, send, realtime, typing, unread.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/AppShell";
import { AppProvider } from "@/context/AppContext";
import { api } from "@/lib/api";

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
  await user.click(await screen.findByRole("button", { name: "Continue" }));      // welcome
  await user.click(await screen.findByRole("button", { name: "Next" }));          // permissions
  await user.click(await screen.findByRole("button", { name }));                  // pick demo account → code step
  await user.click(await screen.findByLabelText("Digit 1"));
  await user.keyboard("123456");                                                  // mocked fixed OTP, auto-submits on 6th digit
  await screen.findByRole("navigation", { name: "Primary" }, { timeout: 8000 });  // main app (bottom nav) is showing
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
    expect(await screen.findByRole("navigation", { name: "Primary" })).toBeInTheDocument(); // straight into the app, no onboarding
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
    await waitFor(() => expect(within(row).getByTestId("unread-badge")).toBeInTheDocument());
    // conversation moved to the top (most recent activity)
    expect(screen.getAllByTestId("conversation-item")[0]).toBe(row);
  });

  it("filter chips narrow the list (Unread / Groups)", async () => {
    const user = await signInAs(/Aarav Sharma/);
    const total = (await screen.findAllByTestId("conversation-item")).length;
    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Filter chats" }));
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
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.type(screen.getByLabelText("Search conversations"), "trek");
    expect((await screen.findAllByText("Weekend Trek 🏔️")).length).toBeGreaterThan(0); // chat hit (+ message hits)
    await user.click(screen.getByLabelText("Close search"));
    await user.click(screen.getByLabelText("Menu"));
    await user.click(await screen.findByRole("menuitem", { name: /Log out/ }));
    expect(await screen.findByRole("button", { name: "Continue" })).toBeInTheDocument(); // back to the welcome screen
    expect(localStorage.getItem("signal.token")).toBeNull();
  });

  it("onboarding: a brand-new number goes welcome → permissions → phone → code → PIN → profile → app", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    await user.click(await screen.findByRole("button", { name: "Next" }));
    const digits = String(Date.now()).slice(-10);
    await user.type(await screen.findByLabelText("Phone number"), digits);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Is the phone number below correct?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "OK" }));
    await user.click(await screen.findByLabelText("Digit 1"));
    await user.keyboard("123456");
    await user.type(await screen.findByLabelText("PIN"), "4321");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(await screen.findByLabelText("First name"), "Test");
    await user.type(screen.getByLabelText("Last name"), "User");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("navigation", { name: "Primary" }, { timeout: 8000 })).toBeInTheDocument();
    expect(await screen.findByText(/No chats yet/, {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it("bottom navigation switches between Chats, Calls and Stories; the unviewed-story badge clears once viewed", async () => {
    localStorage.removeItem("signal.storiesSeen");
    const user = await signInAs(/Aarav Sharma/);
    const stories = screen.getByRole("button", { name: /Stories/ });
    expect(within(stories).getByText("1")).toBeInTheDocument(); // red badge: one unviewed story
    await user.click(screen.getByRole("button", { name: /Calls/ }));
    expect(await screen.findByText("No recent calls")).toBeInTheDocument();
    await user.click(stories);
    expect(await screen.findByText("Recent updates")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Story from Priya Patel" }));
    expect(await screen.findByRole("dialog", { name: "Story from Priya Patel" })).toBeInTheDocument();
    await user.click(screen.getByLabelText("Close story"));
    expect(within(screen.getByRole("button", { name: /Stories/ })).queryByText("1")).toBeNull(); // badge cleared
    expect(JSON.parse(localStorage.getItem("signal.storiesSeen")!)).toContain("demo-trek");
    await user.click(screen.getByRole("button", { name: /Chats/ }));
    expect((await screen.findAllByTestId("conversation-item")).length).toBeGreaterThanOrEqual(7);
    localStorage.removeItem("signal.storiesSeen");
  });

  it("chat menu → Chat settings → Disappearing messages: presets, custom time, Save, and back", async () => {
    const user = await signInAs(/Aarav Sharma/);
    const karan = (await screen.findAllByTestId("conversation-item")).find((i) => within(i).queryByText("Karan Singh"))!;
    await user.click(karan);
    await user.click(await screen.findByLabelText("Conversation menu"));
    const items = screen.getAllByRole("menuitem").map((m) => m.textContent);
    expect(items).toEqual(expect.arrayContaining(["All media", "Chat settings", "Search", "Add to home screen", "Mute notifications"]));
    await user.click(screen.getByRole("menuitem", { name: "Chat settings" }));

    const settings = await screen.findByRole("dialog", { name: "Chat settings" });
    expect(within(settings).getByTestId("settings-title")).toHaveTextContent("Karan Singh");
    for (const t of ["Video", "Audio", "Mute", "Search", "Disappearing messages", "Nickname", "Chat color & wallpaper", "Sounds & notifications", "Phone contact info", "View safety number", "Block"])
      expect(within(settings).getByText(t)).toBeInTheDocument();
    expect(within(settings).getByText("Off")).toBeInTheDocument();

    await user.click(within(settings).getByText("Disappearing messages"));
    const picker = await screen.findByRole("dialog", { name: "Disappearing messages" });
    const labels = within(picker).getAllByRole("radio").map((r) => r.textContent);
    expect(labels).toEqual(["Off", "4 weeks", "1 week", "1 day", "8 hours", "1 hour", "5 minutes", "30 seconds", "Custom time"]);
    expect(within(picker).getByRole("radio", { name: "Off" })).toHaveAttribute("aria-checked", "true");

    await user.click(within(picker).getByRole("radio", { name: "1 hour" }));
    await user.click(within(picker).getByRole("button", { name: "Save" }));
    const back = await screen.findByRole("dialog", { name: "Chat settings" }); // returns to the settings page
    await waitFor(() => expect(within(back).getByText("1 hour")).toBeInTheDocument());

    await user.click(within(back).getByText("Disappearing messages")); // custom time: 90 seconds
    const picker2 = await screen.findByRole("dialog", { name: "Disappearing messages" });
    expect(within(picker2).getByRole("radio", { name: "1 hour" })).toHaveAttribute("aria-checked", "true");
    await user.click(within(picker2).getByRole("radio", { name: "Custom time" }));
    const amount = within(picker2).getByLabelText("Custom amount");
    await user.clear(amount); await user.type(amount, "90");
    await user.selectOptions(within(picker2).getByLabelText("Custom unit"), "seconds");
    await user.click(within(picker2).getByRole("button", { name: "Save" }));
    const back2 = await screen.findByRole("dialog", { name: "Chat settings" });
    await waitFor(() => expect(within(back2).getByText("90 seconds")).toBeInTheDocument());

    await user.click(within(back2).getByText("Disappearing messages")); // out-of-range custom value is blocked, then restore Off
    const picker3 = await screen.findByRole("dialog", { name: "Disappearing messages" });
    const amt = within(picker3).getByLabelText("Custom amount");
    await user.clear(amt); await user.type(amt, "5");
    await user.selectOptions(within(picker3).getByLabelText("Custom unit"), "weeks");
    expect(within(picker3).getByRole("alert")).toHaveTextContent("1 second to 4 weeks");
    expect(within(picker3).getByRole("button", { name: "Save" })).toBeDisabled();
    await user.click(within(picker3).getByRole("radio", { name: "Off" }));
    await user.click(within(picker3).getByRole("button", { name: "Save" }));
    const back3 = await screen.findByRole("dialog", { name: "Chat settings" });
    await waitFor(() => expect(within(back3).getByText("Off")).toBeInTheDocument());
  });

  it("Get started cards can be dismissed and stay dismissed", async () => {
    localStorage.removeItem("signal.getStarted");
    const user = await signInAs(/Aarav Sharma/);
    const region = await screen.findByRole("region", { name: "Get started" });
    expect(within(region).getByText("New group")).toBeInTheDocument();
    expect(within(region).getByText("Invite friends")).toBeInTheDocument();
    await user.click(within(region).getByLabelText("Dismiss New group"));
    expect(within(region).queryByText("New group")).toBeNull();
    expect(JSON.parse(localStorage.getItem("signal.getStarted")!)).toContain("group");
    localStorage.removeItem("signal.getStarted");
  });

  it("a chat started by a non-contact shows 'Name not verified' and explains connections", async () => {
    const vikram = await login("+919810000007");
    const aaravId = (await login("+919810000001")).user.id;
    const conv = await (await fetch(`${API}/api/conversations/direct`, { method: "POST", headers: authed(vikram.token), body: JSON.stringify({ user_id: aaravId }) })).json();
    await fetch(`${API}/api/conversations/${conv.id}/messages`, { method: "POST", headers: authed(vikram.token), body: JSON.stringify({ body: "hi from a stranger", client_id: `s-${Date.now()}` }) });
    const user = await signInAs(/Aarav Sharma/);
    const row = await waitFor(() => {
      const r = screen.getAllByTestId("conversation-item").find((i) => within(i).queryByText(/Vikram/));
      expect(r).toBeTruthy(); return r!;
    }, { timeout: 6000 });
    await user.click(row);
    await user.click(await screen.findByRole("button", { name: /Name not verified/ }, { timeout: 5000 }));
    expect(await screen.findByText(/Connections are people you/)).toBeInTheDocument();
  });
  it("dragging a file onto the chat shows the drop overlay, attaches it, and sends it", async () => {
    const user = await signInAs(/Aarav Sharma/);
    const karan = (await screen.findAllByTestId("conversation-item")).find((i) => within(i).queryByText("Karan Singh"))!;
    await user.click(karan);
    const chat = await screen.findByRole("region", { name: /Chat with Karan Singh/ });
    const file = new File(["hello drag and drop"], `dropped-${Date.now()}.txt`, { type: "text/plain" });
    // jsdom's File/FormData can't be sent as multipart by Node fetch, so stub only the upload call; the real multipart upload is covered by the live smoke test.
    const spy = vi.spyOn(api, "upload").mockResolvedValue({ url: `/uploads/${"a".repeat(32)}.txt`, name: file.name, type: file.type, size: file.size });
    fireEvent.dragEnter(chat, { dataTransfer: { types: ["Files"], files: [file] } });
    expect(await screen.findByTestId("drop-overlay")).toBeInTheDocument();
    fireEvent.drop(chat, { dataTransfer: { types: ["Files"], files: [file] } });
    expect(screen.queryByTestId("drop-overlay")).toBeNull();
    expect(await screen.findByLabelText("Remove attachment", {}, { timeout: 5000 })).toBeInTheDocument(); // uploaded + previewed
    await user.click(await screen.findByTestId("send"));
    const list = screen.getByTestId("message-list");
    expect(await within(list).findByText(file.name, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith(file);
    spy.mockRestore();
  });

  it("plain text drags do not trigger the drop overlay", async () => {
    const user = await signInAs(/Aarav Sharma/);
    const karan = (await screen.findAllByTestId("conversation-item")).find((i) => within(i).queryByText("Karan Singh"))!;
    await user.click(karan);
    const chat = await screen.findByRole("region", { name: /Chat with Karan Singh/ });
    fireEvent.dragEnter(chat, { dataTransfer: { types: ["text/plain"], files: [] } });
    expect(screen.queryByTestId("drop-overlay")).toBeNull();
  });

  it("profile picture → Settings → Appearance → Theme → Dark switches the theme", async () => {
    const user = await signInAs(/Aarav Sharma/);
    await user.click(await screen.findByRole("button", { name: "Your profile" }));
    await user.click(await screen.findByRole("button", { name: /^Appearance/ }));
    await user.click(await screen.findByRole("button", { name: /^Theme/ }));
    await user.click(await screen.findByRole("radio", { name: "Dark" }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    expect(screen.getByRole("button", { name: /^Theme/ })).toHaveTextContent("Dark");
  });

  it("profile → Settings → Account → Delete Account asks for the number, then logs out", async () => {
    const user = await signInAs(/Aarav Sharma/);
    await user.click(await screen.findByRole("button", { name: "Your profile" }));
    await user.click(await screen.findByRole("button", { name: /^Account/ }));
    expect(await screen.findByText("Signal PIN")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Delete Account/ }));
    const del = screen.getByRole("button", { name: "Delete" });
    expect(del).toBeDisabled();
    await user.type(screen.getByLabelText("Confirm phone number or username"), "+919810000001");
    expect(del).toBeEnabled();
    await user.click(del);
    await waitFor(() => expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument());
  });
});
