import { describe, it, expect } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { saveTokens, loadTokens, clearTokens } from "./auth-store";

describe("auth store", () => {
  it("keeps the pair in IndexedDB and mirrors only the access token into storage.session", async () => {
    await saveTokens({ accessToken: "dosm_a", refreshToken: "dosr_r", user: { id: "u", email: "e", name: "n" } });
    expect(await loadTokens()).toEqual({ accessToken: "dosm_a", refreshToken: "dosr_r", user: { id: "u", email: "e", name: "n" } });
    expect(await fakeBrowser.storage.session.get("accessToken")).toEqual({ accessToken: "dosm_a" });
    expect(await fakeBrowser.storage.local.get(null)).toEqual({});
  });
  it("clearTokens removes both", async () => {
    await saveTokens({ accessToken: "a", refreshToken: "r", user: { id: "u", email: "e", name: "n" } });
    await clearTokens();
    expect(await loadTokens()).toBeNull();
    expect(await fakeBrowser.storage.session.get("accessToken")).toEqual({});
  });
});
