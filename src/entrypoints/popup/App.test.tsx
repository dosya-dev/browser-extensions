import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fakeBrowser } from "wxt/testing/fake-browser";
import type { PopupState } from "../../lib/messages";
const sendMock = vi.fn();
vi.mock("../../lib/messages", async (orig) => ({ ...(await orig<typeof import("../../lib/messages")>()), send: (m: unknown) => sendMock(m) }));
import App from "./App";

const done: PopupState["recent"][number] = { id: "1", filename: "golden-hour-field.jpg", state: "done", kind: "image", sourceUrl: "https://u", sourceTitle: "U", workspaceId: "ws", folderId: "fo", folderName: "Autumn shoot", sha256: "", bytes: 10, createdAt: Date.now() - 1000, updatedAt: Date.now(), fileId: "file_1", message: null, attempts: 0, nextAttemptAt: 0 };
const signedIn: PopupState = { signedIn: true, user: { id: "u", email: "firat@dosya.dev", name: "Firat Kaya" }, destination: { workspaceId: "ws", workspaceName: "Personal", folderId: "fo", folderName: "Autumn shoot" }, recent: [done, { ...done, id: "2", filename: "moodboard.webp", state: "queued", nextAttemptAt: Date.now() + 60000, message: "Waiting for network" }], queued: 0, waiting: 1, animations: true };

let root: Root; let el: HTMLDivElement;
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; sendMock.mockReset(); el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el); });
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }); };
const mount = async () => { await act(async () => { root.render(<App />); }); await flush(); };
const click = async (label: string) => { const b = [...el.querySelectorAll("button")].find((x) => x.textContent?.includes(label) || x.getAttribute("aria-label") === label); expect(b, label).toBeTruthy(); await act(async () => { b!.click(); }); };

describe("popup, layout A", () => {
  it("signed out: the button asks for the dosya origins, then sends sign-in", async () => {
    sendMock.mockImplementation(async (m: { type: string }) => (m.type === "get-state" ? { ...signedIn, signedIn: false, user: null } : { ok: true }));
    fakeBrowser.permissions.request = vi.fn(async () => true);
    await mount();
    expect(el.textContent).toContain("Sign in with dosya");
    await click("Sign in with dosya");
    await flush();
    expect(fakeBrowser.permissions.request).toHaveBeenCalledWith({ origins: ["https://api.dosya.dev/*", "https://app.dosya.dev/*"] });
    expect(sendMock).toHaveBeenCalledWith({ type: "sign-in" });
    const permissionCall = (fakeBrowser.permissions.request as unknown as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0];
    const signInCall = sendMock.mock.invocationCallOrder[sendMock.mock.calls.findIndex((c) => (c[0] as { type: string }).type === "sign-in")];
    expect(permissionCall).toBeLessThan(signInCall);
  });
  it("signed out: a refused permission shows why and does not sign in", async () => {
    sendMock.mockImplementation(async (m: { type: string }) => (m.type === "get-state" ? { ...signedIn, signedIn: false, user: null } : { ok: true }));
    fakeBrowser.permissions.request = vi.fn(async () => false);
    await mount();
    await click("Sign in with dosya");
    await flush();
    expect(el.textContent).toContain("dosya needs permission to reach api.dosya.dev to save files");
    expect(sendMock).not.toHaveBeenCalledWith({ type: "sign-in" });
  });
  it("signed in: header, destination, both actions, recent rows with states, footer counts", async () => {
    sendMock.mockImplementation(async (m: { type: string }) => (m.type === "get-state" ? signedIn : { ok: true }));
    await mount();
    expect(el.textContent).toContain("firat@dosya.dev"); expect(el.textContent).toContain("FK");
    expect(el.textContent).toContain("Autumn shoot");
    expect(el.textContent).toContain("Save visible screenshot"); expect(el.textContent).toContain("Save selection");
    expect(el.textContent).toContain("golden-hour-field.jpg"); expect(el.textContent).toContain("Waiting for network");
    expect(el.textContent).toContain("1 saved today"); expect(el.textContent).toContain("1 waiting");
    await click("Save visible screenshot");
    expect(sendMock).toHaveBeenCalledWith({ type: "save-screenshot" });
  });
  it("a saved row links to the file in dosya and shows its thumbnail; a waiting row does neither", async () => {
    const withThumb = { ...signedIn, recent: [{ ...done, thumb: "data:image/jpeg;base64,AQID" }, signedIn.recent[1]!] };
    sendMock.mockImplementation(async (m: { type: string }) => (m.type === "get-state" ? withThumb : { ok: true }));
    await mount();
    const links = [...el.querySelectorAll("a[title='Open in dosya']")] as HTMLAnchorElement[];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["https://app.dosya.dev/files?view=file_1"]);
    expect(links[0]!.target).toBe("_blank");
    expect(links[0]!.querySelector("img")?.getAttribute("src")).toBe("data:image/jpeg;base64,AQID");
  });
  it("the account button shows who is signed in and starts account deletion", async () => {
    // Apple requires deletion to be reachable from inside the app. It finishes
    // on dosya, because it needs a password and a confirmation, so what this
    // pins is that the route STARTS here and lands on the deletion page itself
    // rather than somewhere the person has to go looking.
    sendMock.mockImplementation(async (m: { type: string }) => (m.type === "get-state" ? signedIn : { ok: true }));
    await mount();
    await click("Account");
    const panel = el.querySelector("[role=dialog][aria-label=Account]");
    expect(panel, "account panel").toBeTruthy();
    expect(panel!.textContent).toContain("Firat Kaya");
    expect(panel!.textContent).toContain("firat@dosya.dev");
    const remove = Array.from(panel!.querySelectorAll("a")).find((a) => a.textContent?.includes("Delete account"));
    expect(remove?.getAttribute("href")).toBe("https://app.dosya.dev/profile/delete");
    expect(remove?.target).toBe("_blank");
  });

  it("settings offers Help and About alongside Sign out", async () => {
    sendMock.mockImplementation(async (m: { type: string }) => (m.type === "get-state" ? signedIn : { ok: true }));
    await mount();
    await click("Settings");
    const menu = el.querySelector("[role=menu]");
    expect(menu, "settings menu").toBeTruthy();
    const links = Object.fromEntries(
      Array.from(menu!.querySelectorAll("a")).map((a) => [a.textContent?.trim(), a.getAttribute("href")]),
    );
    expect(links).toEqual({ Help: "https://dosya.dev/help/", About: "https://dosya.dev/about/" });
    expect(menu!.textContent).toContain("Sign out");
  });

  it("settings carries an Animations switch that writes the preference", async () => {
    sendMock.mockImplementation(async (m: { type: string }) => (m.type === "get-state" ? signedIn : { ok: true }));
    await mount();
    await click("Settings");
    const toggle = el.querySelector("[role=menuitemcheckbox]") as HTMLButtonElement | null;
    expect(toggle, "animations switch").toBeTruthy();
    expect(toggle!.textContent).toContain("Animations");
    expect(toggle!.getAttribute("aria-checked")).toBe("true");
    await act(async () => { toggle!.click(); });
    expect(sendMock).toHaveBeenCalledWith({ type: "set-animations", on: false });
  });

  it("shows the Animations switch off once the preference is off", async () => {
    sendMock.mockImplementation(async (m: { type: string }) => (m.type === "get-state" ? { ...signedIn, animations: false } : { ok: true }));
    await mount();
    await click("Settings");
    expect(el.querySelector("[role=menuitemcheckbox]")!.getAttribute("aria-checked")).toBe("false");
  });

  it("copy link opens the dialog with 7 days preselected and copies the url", async () => {
    const writeText = vi.fn(async () => {}); Object.assign(navigator, { clipboard: { writeText } });
    sendMock.mockImplementation(async (m: { type: string }) => (m.type === "get-state" ? signedIn : m.type === "copy-link" ? { url: "https://dosya.dev/s/abc" } : { ok: true }));
    await mount();
    await click("Copy link");
    expect(el.textContent).toContain("Anyone with the link can view");
    expect([...el.querySelectorAll("button[aria-pressed='true']")].map((b) => b.textContent)).toEqual(["7 days"]);
    await click("Copy link");
    expect(sendMock).toHaveBeenCalledWith({ type: "copy-link", itemId: "1", expiresDays: 7 });
    expect(writeText).toHaveBeenCalledWith("https://dosya.dev/s/abc");
    expect(el.textContent).toContain("Copied");
  });
  it("a waiting row's retry button sends retry", async () => {
    sendMock.mockImplementation(async (m: { type: string }) => (m.type === "get-state" ? signedIn : { ok: true }));
    await mount();
    await click("Retry now");
    expect(sendMock).toHaveBeenCalledWith({ type: "retry", itemId: "2" });
  });
  it("a blocked image shows the permission banner; Allow requests the origin and retries that row", async () => {
    await fakeBrowser.storage.local.set({ blockedOrigins: ["https://cdn.x.com/*"] });
    fakeBrowser.permissions.request = vi.fn(async () => true);
    const blocked: PopupState["recent"][number] = { ...done, id: "3", state: "failed", message: "blocked", imageUrl: "https://cdn.x.com/a.jpg", filename: "a.jpg" };
    const stateWithBlocked: PopupState = { ...signedIn, recent: [blocked, ...signedIn.recent] };
    sendMock.mockImplementation(async (m: { type: string }) => (m.type === "get-state" ? stateWithBlocked : { ok: true }));
    await mount();
    await flush();
    expect(el.textContent).toContain("cdn.x.com");
    await click("Allow");
    await flush();
    expect(fakeBrowser.permissions.request).toHaveBeenCalledTimes(1);
    expect(fakeBrowser.permissions.request).toHaveBeenCalledWith({ origins: ["https://cdn.x.com/*"] });
    expect(sendMock).toHaveBeenCalledWith({ type: "retry", itemId: "3" });
  });
});
