// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { createRefresher } from "./refresh";
import { saveTokens, loadTokens } from "../store/auth-store";
const user = { id: "u", email: "e", name: "n" };

afterEach(() => { vi.unstubAllGlobals(); });

describe("refresher", () => {
  it("rotates the pair once for concurrent callers", async () => {
    await saveTokens({ accessToken: "a0", refreshToken: "r0", user });
    const f = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response('{"ok":true,"access_token":"a1","refresh_token":"r1"}', { status: 200 })); vi.stubGlobal("fetch", f);
    const r = createRefresher("https://api.test");
    const [x, y] = await Promise.all([r.refresh(), r.refresh()]);
    expect(x).toBe("a1"); expect(y).toBe("a1"); expect(f).toHaveBeenCalledTimes(1);
    expect(JSON.parse((f.mock.calls[0][1] as RequestInit).body as string)).toEqual({ refresh_token: "r0" });
    expect((f.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty("Authorization");
    expect((await loadTokens())?.refreshToken).toBe("r1");
  });
  it("a 401 clears the tokens and returns null", async () => {
    await saveTokens({ accessToken: "a0", refreshToken: "r0", user });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    expect(await createRefresher("https://api.test").refresh()).toBeNull();
    expect(await loadTokens()).toBeNull();
  });
  it("a 503 keeps the tokens and returns the current access token", async () => {
    await saveTokens({ accessToken: "a0", refreshToken: "r0", user });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    expect(await createRefresher("https://api.test").refresh()).toBe("a0");
    expect((await loadTokens())?.refreshToken).toBe("r0");
  });
});
