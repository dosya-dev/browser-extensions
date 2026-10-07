// @vitest-environment node
import { describe, it, expect } from "vitest";
import { stripInstallTimeAllUrls } from "./manifest-hooks";

describe("stripInstallTimeAllUrls", () => {
  it("removes every <all_urls> entry and keeps the two dosya origins in order", () => {
    const m = { host_permissions: ["<all_urls>", "https://api.dosya.dev/*", "<all_urls>", "https://app.dosya.dev/*"] };
    stripInstallTimeAllUrls(m);
    expect(m.host_permissions).toEqual(["https://api.dosya.dev/*", "https://app.dosya.dev/*"]);
  });
  it("leaves optional_host_permissions alone", () => {
    const m = { host_permissions: ["<all_urls>"], optional_host_permissions: ["<all_urls>"] };
    stripInstallTimeAllUrls(m);
    expect(m.host_permissions).toEqual([]);
    expect(m.optional_host_permissions).toEqual(["<all_urls>"]);
  });
  it("tolerates a manifest with no host_permissions array", () => {
    const m: { host_permissions?: string[] } = {};
    expect(() => stripInstallTimeAllUrls(m)).not.toThrow();
    expect(m.host_permissions).toBeUndefined();
  });
});
