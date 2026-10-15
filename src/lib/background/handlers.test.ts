// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { createHandlers } from "./handlers";
import { saveTokens } from "../store/auth-store";
import { setDestination } from "../store/prefs";
import { listItems, putItem } from "../store/items";
import { takeBlocked } from "../permissions";
import type { SaveItem } from "../messages";
const PNG = "data:image/png;base64,iVBORw0KGgo=";
function ctx(over: Partial<Parameters<typeof createHandlers>[0]> = {}) {
  const ticks: number[] = [];
  return {
    client: { fetch: vi.fn(), json: vi.fn() } as never,
    refresher: { refresh: vi.fn(async () => "new") },
    runner: { tick: vi.fn(async () => { ticks.push(1); }), recoverOnStartup: vi.fn(async () => 0), running: new Set<string>() },
    now: () => 1_000_000,
    captureTab: async () => PNG,
    activeTab: async () => ({ id: 1, title: "Page", url: "https://p" }),
    askPage: async () => ({ text: "sel", title: "Page", url: "https://p" }),
    fetchImage: async () => { throw new Error("no"); },
    fetchViaPage: async () => { throw new Error("no"); },
    notify: vi.fn(async () => {}),
    setBadge: vi.fn(async () => {}),
    startSignIn: vi.fn(async () => ({ ok: true as const })),
    ticks,
    ...over,
  };
}
const dest = { workspaceId: "ws", workspaceName: "P", folderId: "fo", folderName: "F" };
describe("background handlers", () => {
  it("initializes the signed-in destination before the first capture so the folder picker can open", async () => {
    await saveTokens({ accessToken: "a", refreshToken: "r", user: { id: "u", email: "e", name: "n" } });
    const c = ctx();
    vi.mocked(c.client.json).mockResolvedValue({ workspaces: [{ id: "ws", name: "Personal", e2ee_mode: 0 }] });
    const state = await createHandlers(c).handle({ type: "get-state" }) as import("../messages").PopupState;
    expect(state.destination).toEqual({ workspaceId: "ws", workspaceName: "Personal", folderId: null, folderName: "Personal" });
    expect(await listItems()).toEqual([]);
  });
  it("does not fetch or initialize a destination while signed out", async () => {
    const c = ctx();
    const state = await createHandlers(c).handle({ type: "get-state" }) as import("../messages").PopupState;
    expect(state.destination).toBeNull();
    expect(c.client.json).not.toHaveBeenCalled();
  });
  it("preserves the chosen destination when reopening the popup", async () => {
    await saveTokens({ accessToken: "a", refreshToken: "r", user: { id: "u", email: "e", name: "n" } });
    await setDestination(dest);
    const c = ctx();
    const state = await createHandlers(c).handle({ type: "get-state" }) as import("../messages").PopupState;
    expect(state.destination).toEqual(dest);
    expect(c.client.json).not.toHaveBeenCalled();
  });
  it("signed out: a save is refused with signed-out, nothing stored, sign-in started", async () => {
    const c = ctx(); const h = createHandlers(c);
    expect(await h.handle({ type: "save-screenshot" })).toEqual({ ok: false, error: "signed-out" });
    expect(await listItems()).toEqual([]); expect(c.startSignIn).toHaveBeenCalled();
  });
  it("save-selection reports no-page when the page cannot be reached, and stores nothing", async () => {
    await saveTokens({ accessToken: "a", refreshToken: "r", user: { id: "u", email: "e", name: "n" } }); await setDestination(dest);
    const c = ctx({ askPage: async () => { throw new Error("no receiver"); } });
    expect(await createHandlers(c).handle({ type: "save-selection" })).toEqual({ ok: false, error: "no-page" });
    expect(await listItems()).toEqual([]);
  });
  it("sign-in guard: a fresh pending record blocks relaunch; a stale one allows it", async () => {
    const c = ctx(); const h = createHandlers(c);
    await fakeBrowser.storage.session.set({ pendingPkce: { verifier: "v".repeat(64), state: "s".repeat(32), client: "chrome", startedAt: Date.now() } });
    await h.handle({ type: "save-screenshot" });
    await h.handle({ type: "save-screenshot" });
    expect(c.startSignIn).toHaveBeenCalledTimes(0);
    await fakeBrowser.storage.session.set({ pendingPkce: { verifier: "v".repeat(64), state: "s".repeat(32), client: "chrome", startedAt: Date.now() - 6 * 60_000 } });
    await h.handle({ type: "save-screenshot" });
    expect(c.startSignIn).toHaveBeenCalledTimes(1);
  });
  it("signed in: a screenshot is stored, the queue ticks, the badge shows 1", async () => {
    await saveTokens({ accessToken: "a", refreshToken: "r", user: { id: "u", email: "e", name: "n" } }); await setDestination(dest);
    const c = ctx(); const h = createHandlers(c);
    expect(await h.handle({ type: "save-screenshot" })).toEqual({ ok: true });
    const items = await listItems(); expect(items).toHaveLength(1); expect(items[0].kind).toBe("screenshot"); expect(items[0].folderId).toBe("fo");
    expect(c.runner.tick).toHaveBeenCalled(); expect(c.setBadge).toHaveBeenCalledWith("1");
  });
  it("get-state reports the user, destination, recent items and counts", async () => {
    await saveTokens({ accessToken: "a", refreshToken: "r", user: { id: "u", email: "e", name: "Firat" } }); await setDestination(dest);
    const base: SaveItem = { id: "1", filename: "f", state: "queued", kind: "image", sourceUrl: "", sourceTitle: "", workspaceId: "ws", folderId: null, sha256: "", bytes: 1, createdAt: 1, updatedAt: 1, fileId: null, message: null, attempts: 0, nextAttemptAt: 9e12 };
    await putItem(base); await putItem({ ...base, id: "2", state: "done", createdAt: 2 });
    const s = await createHandlers(ctx()).handle({ type: "get-state" }) as { signedIn: boolean; user: { name: string }; recent: SaveItem[]; queued: number; waiting: number };
    expect(s.signedIn).toBe(true); expect(s.user.name).toBe("Firat"); expect(s.recent.map((i) => i.id)).toEqual(["2", "1"]); expect(s.queued).toBe(0); expect(s.waiting).toBe(1);
  });
  it("copy-link turns days into an absolute expiry", async () => {
    await saveTokens({ accessToken: "a", refreshToken: "r", user: { id: "u", email: "e", name: "n" } });
    const json = vi.fn(async (_path: string, _init?: RequestInit) => ({ link: { url: "https://dosya.dev/s/x" } }));
    const c = ctx({ client: { fetch: vi.fn(), json } as never });
    await putItem({ id: "1", filename: "f", state: "done", kind: "image", sourceUrl: "", sourceTitle: "", workspaceId: "ws", folderId: null, sha256: "", bytes: 1, createdAt: 1, updatedAt: 1, fileId: "file_1", message: null, attempts: 0, nextAttemptAt: 0 });
    expect(await createHandlers(c).handle({ type: "copy-link", itemId: "1", expiresDays: 7 })).toEqual({ url: "https://dosya.dev/s/x" });
    expect(JSON.parse((json.mock.calls[0][1] as RequestInit).body as string)).toEqual({ expires_at: 1_000 + 7 * 86400 });
  });
  it("retry re-queues now and ticks", async () => {
    await putItem({ id: "1", filename: "f", state: "failed", kind: "image", sourceUrl: "", sourceTitle: "", workspaceId: "ws", folderId: null, sha256: "", bytes: 1, createdAt: 1, updatedAt: 1, fileId: null, message: "x", attempts: 3, nextAttemptAt: 0 });
    const c = ctx(); await createHandlers(c).handle({ type: "retry", itemId: "1" });
    expect((await listItems())[0]).toMatchObject({ state: "queued", nextAttemptAt: 1_000_000 }); expect(c.runner.tick).toHaveBeenCalled();
  });
  it("saveImage stores a failed item and remembers the origin when both fetch paths are blocked", async () => {
    await saveTokens({ accessToken: "a", refreshToken: "r", user: { id: "u", email: "e", name: "n" } }); await setDestination(dest);
    const c = ctx({ fetchImage: async () => { throw new Error("cors"); }, fetchViaPage: async () => { throw new Error("blocked"); } });
    const h = createHandlers(c);
    const r = await h.saveImage("https://cdn.x.com/a.jpg", { id: 1, title: "Page", url: "https://p" });
    expect(r).toEqual({ ok: false, error: "blocked" });
    const items = await listItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "image", state: "failed", message: "blocked", imageUrl: "https://cdn.x.com/a.jpg", sourceUrl: "https://p", sourceTitle: "Page", bytes: 0, sha256: "", workspaceId: "ws", folderId: "fo" });
    expect(await takeBlocked(["https://cdn.x.com/*"])).toEqual(["https://cdn.x.com/*"]);
  });
  it("retry on a blocked image item re-runs the image capture, not the upload", async () => {
    await saveTokens({ accessToken: "a", refreshToken: "r", user: { id: "u", email: "e", name: "n" } }); await setDestination(dest);
    await putItem({ id: "1", filename: "a.jpg", state: "failed", kind: "image", sourceUrl: "https://p", sourceTitle: "Page", workspaceId: "ws", folderId: "fo", folderName: "F", sha256: "", bytes: 0, createdAt: 1, updatedAt: 1, fileId: null, message: "blocked", attempts: 0, nextAttemptAt: 0, imageUrl: "https://cdn.x.com/a.jpg" });
    const c = ctx({ fetchImage: async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } }) });
    const h = createHandlers(c);
    const r = await h.handle({ type: "retry", itemId: "1" });
    expect(r).toEqual({ ok: true });
    const items = await listItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).not.toBe("1");
    expect(items[0]).toMatchObject({ kind: "image", state: "queued", workspaceId: "ws", folderId: "fo" });
  });
  it("retry on a still-blocked image leaves the row present, failed, and replies blocked", async () => {
    await saveTokens({ accessToken: "a", refreshToken: "r", user: { id: "u", email: "e", name: "n" } }); await setDestination(dest);
    await putItem({ id: "1", filename: "a.jpg", state: "failed", kind: "image", sourceUrl: "https://p", sourceTitle: "Page", workspaceId: "ws", folderId: "fo", folderName: "F", sha256: "", bytes: 0, createdAt: 1, updatedAt: 1, fileId: null, message: "blocked", attempts: 0, nextAttemptAt: 0, imageUrl: "https://cdn.x.com/a.jpg" });
    const c = ctx({ fetchImage: async () => { throw new Error("cors"); } });
    const h = createHandlers(c);
    const r = await h.handle({ type: "retry", itemId: "1" });
    expect(r).toEqual({ ok: false, error: "blocked" });
    const items = await listItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "1", state: "failed", message: "blocked", imageUrl: "https://cdn.x.com/a.jpg" });
  });

});

describe("the save flight is primed while the click's grant is live", () => {
  // Safari drops the activeTab grant almost as soon as the gesture ends, so a
  // tab reached into only at upload-completion time refuses the injection and
  // the flight is never drawn. Every capture path has to claim its tab up front.
  it("notes the tab and the item for a screenshot", async () => {
    const primed: Array<[number, string]> = [];
    await saveTokens({ accessToken: "a", refreshToken: "r", user: { id: "u", email: "e", name: "n" } });
    await setDestination(dest);
    const c = ctx({ primeAnimation: (tabId: number, itemId: string) => { primed.push([tabId, itemId]); } });
    await createHandlers(c).handle({ type: "save-screenshot" });
    expect(primed.length, "primed once").toBe(1);
    expect(primed[0]![0], "the tab the capture came from").toBe(1);
    const items = await listItems();
    expect(primed[0]![1], "the item it belongs to").toBe(items[0]!.id);
  });

  it("notes the tab for a selection too", async () => {
    const primed: Array<[number, string]> = [];
    await saveTokens({ accessToken: "a", refreshToken: "r", user: { id: "u", email: "e", name: "n" } });
    await setDestination(dest);
    const c = ctx({ primeAnimation: (tabId: number, itemId: string) => { primed.push([tabId, itemId]); } });
    await createHandlers(c).handle({ type: "save-selection" });
    expect(primed.length).toBe(1);
    expect(primed[0]![0]).toBe(1);
  });
});
