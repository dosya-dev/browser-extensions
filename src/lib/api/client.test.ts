// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { createClient, ApiError } from "./client";
const res = (status: number, body = "{}", headers: Record<string, string> = {}) => new Response(body, { status, headers });
function provider(tokens: (string | null)[]) { let i = 0; return { get: async () => tokens[Math.min(i, tokens.length - 1)], refresh: vi.fn(async () => tokens[++i] ?? null) }; }

afterEach(() => { vi.unstubAllGlobals(); });

describe("api client", () => {
  it("sends the bearer and returns json", async () => {
    const f = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => res(200, '{"ok":true}')); vi.stubGlobal("fetch", f);
    const c = createClient(provider(["t1"]), "https://api.test", { sleep: async () => {} });
    expect(await c.json("/api/workspaces")).toEqual({ ok: true });
    expect((f.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer t1" });
  });
  it("refreshes once on 401 and retries with the new token", async () => {
    const f = vi.fn().mockResolvedValueOnce(res(401)).mockResolvedValueOnce(res(200, '{"ok":1}')); vi.stubGlobal("fetch", f);
    const p = provider(["old", "new"]);
    const c = createClient(p, "https://api.test", { sleep: async () => {} });
    expect(await c.json("/api/x")).toEqual({ ok: 1 });
    expect(p.refresh).toHaveBeenCalledTimes(1);
    expect((f.mock.calls[1][1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer new" });
  });
  it("a second 401 is an ApiError, not a loop", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(401)));
    const c = createClient(provider(["a", "b"]), "https://api.test", { sleep: async () => {} });
    await expect(c.json("/api/x")).rejects.toMatchObject({ status: 401 });
  });
  it("retries 503 and network errors three times with growing waits, then throws", async () => {
    const waits: number[] = [];
    const f = vi.fn().mockRejectedValueOnce(new TypeError("net")).mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(200, "{}")); vi.stubGlobal("fetch", f);
    const c = createClient(provider(["t"]), "https://api.test", { sleep: async (ms) => { waits.push(ms); } });
    await c.json("/api/x");
    expect(waits).toEqual([1000, 2000]);
    vi.stubGlobal("fetch", vi.fn(async () => res(503)));
    await expect(c.json("/api/x")).rejects.toBeInstanceOf(ApiError);
  });
  it("429 carries Retry-After", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(429, "{}", { "Retry-After": "17" })));
    const c = createClient(provider(["t"]), "https://api.test", { sleep: async () => {} });
    await expect(c.json("/api/x")).rejects.toMatchObject({ status: 429, retryAfterS: 17 });
  });
});
