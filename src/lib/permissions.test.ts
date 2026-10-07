// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { originPattern, rememberBlocked, takeBlocked, peekBlocked, requestOrigins } from "./permissions";

describe("permissions", () => {
  it("turns an image url into an origin pattern", () => {
    expect(originPattern("https://cdn.x.com/a/b.jpg?x=1")).toBe("https://cdn.x.com/*");
  });
  it("remembers blocked origins once and hands them over once", async () => {
    await rememberBlocked("https://cdn.x.com/a.jpg");
    await rememberBlocked("https://cdn.x.com/b.jpg");
    expect(await takeBlocked(["https://cdn.x.com/*"])).toEqual(["https://cdn.x.com/*"]);
    expect(await takeBlocked(["https://cdn.x.com/*"])).toEqual([]);
    expect(await fakeBrowser.storage.local.get("blockedOrigins")).toEqual({});
  });
  it("ignores an image whose scheme can never be granted", async () => {
    await rememberBlocked("blob:https://x.com/9f1c-4");
    await rememberBlocked("data:image/png;base64,AAAA");
    expect(await peekBlocked()).toEqual([]);
    expect(await fakeBrowser.storage.local.get("blockedOrigins")).toEqual({});
  });
  it("peeks blocked origins without clearing them", async () => {
    await rememberBlocked("https://cdn.y.com/a.jpg");
    expect(await peekBlocked()).toEqual(["https://cdn.y.com/*"]);
    expect(await peekBlocked()).toEqual(["https://cdn.y.com/*"]);
    expect(await takeBlocked(["https://cdn.y.com/*"])).toEqual(["https://cdn.y.com/*"]);
    expect(await peekBlocked()).toEqual([]);
  });
  it("takes only the given patterns and keeps the rest", async () => {
    await rememberBlocked("https://a.com/x.jpg");
    await rememberBlocked("https://b.com/y.jpg");
    expect(await takeBlocked(["https://a.com/*"])).toEqual(["https://a.com/*"]);
    expect(await peekBlocked()).toEqual(["https://b.com/*"]);
  });
  it("requests every pattern in one permission prompt", async () => {
    fakeBrowser.permissions.request = vi.fn(async () => true);
    expect(await requestOrigins(["https://a.com/*", "https://b.com/*"])).toBe(true);
    expect(fakeBrowser.permissions.request).toHaveBeenCalledTimes(1);
    expect(fakeBrowser.permissions.request).toHaveBeenCalledWith({ origins: ["https://a.com/*", "https://b.com/*"] });
  });
});
