// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { buildConsentUrl, startSignIn, completeSignIn, signOut } from "./sign-in";
import { loadTokens, saveTokens } from "../store/auth-store";
import { getPendingPkce, getDestination, setDestination, setPendingPkce } from "../store/prefs";
import { listItems, putItem, putBlob, getBlob } from "../store/items";
import type { SaveItem } from "../messages";

afterEach(() => vi.unstubAllGlobals());

describe("sign-in", () => {
  it("builds the consent url with the four fields", () => {
    const u = new URL(buildConsentUrl({ client: "chrome", challenge: "C".repeat(43), state: "s".repeat(32), redirectUri: "https://abc.chromiumapp.org/callback" }));
    expect(u.origin + u.pathname).toBe("https://app.dosya.dev/connect/extension");
    expect(Object.fromEntries(u.searchParams)).toEqual({ client: "chrome", code_challenge: "C".repeat(43), state: "s".repeat(32), redirect_uri: "https://abc.chromiumapp.org/callback" });
  });
  it("startSignIn stores the pending pkce, launches, and completes with the code from the callback", async () => {
    const f = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({ ok: true, access_token: "a", refresh_token: "r", user: { id: "u", email: "e", name: "n" } }), { status: 200 })); vi.stubGlobal("fetch", f);
    let launched = "";
    const launch = async (url: string) => { launched = url; const state = new URL(url).searchParams.get("state")!; return `https://abc.chromiumapp.org/callback?code=dmoc_1&state=${state}`; };
    const r = await startSignIn({ client: "chrome", launch, redirectUri: "https://abc.chromiumapp.org/callback" });
    expect(r).toEqual({ ok: true });
    expect(launched).toContain("/connect/extension?client=chrome");
    expect((await loadTokens())?.accessToken).toBe("a");
    expect(await getPendingPkce()).toBeNull();
    const body = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string);
    expect(body.code).toBe("dmoc_1"); expect(body.client).toBe("chrome"); expect(body.code_verifier).toMatch(/^[A-Za-z0-9_-]{64}$/);
  });
  it("a callback whose state does not match is refused and leaves no tokens", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const launch = async () => "https://abc.chromiumapp.org/callback?code=dmoc_1&state=wrong";
    const r = await startSignIn({ client: "firefox", launch, redirectUri: "https://abc.chromiumapp.org/callback" });
    expect(r.ok).toBe(false);
    expect(await loadTokens()).toBeNull();
  });
  it("a cancelled launch is reported, not thrown", async () => {
    const r = await startSignIn({ client: "chrome", launch: async () => null, redirectUri: "x" });
    expect(r).toEqual({ ok: false, error: "Sign-in was cancelled" });
  });
  it("signOut leaves nothing of the previous account behind", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    const now = Date.now();
    const item: SaveItem = { id: "i1", filename: "a.png", state: "done", kind: "image", sourceUrl: "", sourceTitle: "", workspaceId: "w", folderId: null, sha256: "", bytes: 1, createdAt: now, updatedAt: now, fileId: "f", message: null, attempts: 0, nextAttemptAt: now };
    await saveTokens({ accessToken: "a", refreshToken: "r", user: { id: "u", email: "e", name: "n" } });
    await setDestination({ workspaceId: "w", workspaceName: "W", folderId: null, folderName: "W" });
    await setPendingPkce({ verifier: "v".repeat(64), state: "S".repeat(32), client: "chrome", startedAt: now });
    await putItem(item); await putBlob("i1", new Blob(["x"]));
    await fakeBrowser.storage.local.set({ "folders:w": { folders: [], cachedAt: now }, blockedOrigins: ["https://cdn.x.com/*"], keepMe: 1 });

    const client = { fetch: vi.fn(async () => new Response("{}", { status: 200 })), json: vi.fn() };
    await signOut(client as unknown as Parameters<typeof signOut>[0]);

    expect(await loadTokens()).toBeNull();
    expect(await getDestination()).toBeNull();
    expect(await listItems()).toEqual([]);
    expect(await getBlob("i1")).toBeNull();
    expect(await getPendingPkce()).toBeNull();
    const local = await fakeBrowser.storage.local.get(null);
    expect(Object.keys(local).filter((k) => k.startsWith("folders:"))).toEqual([]);
    expect(local.blockedOrigins).toBeUndefined();
    expect(local.keepMe).toBe(1);
  });
  it("completeSignIn works for the done-page fallback", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, access_token: "a2", refresh_token: "r2", user: { id: "u", email: "e", name: "n" } }), { status: 200 })));
    await fakeBrowser.storage.session.set({ pendingPkce: { verifier: "v".repeat(64), state: "S".repeat(32), client: "edge" } });
    expect(await completeSignIn({ code: "dmoc_2", state: "S".repeat(32) })).toEqual({ ok: true });
    expect((await loadTokens())?.accessToken).toBe("a2");
  });
});
