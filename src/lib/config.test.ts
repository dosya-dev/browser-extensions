import { describe, it, expect } from "vitest";
import { API_BASE, APP_BASE, MAX_UPLOAD_BYTES, MAX_SELECTION_CHARS, currentClient } from "./config";

describe("config", () => {
  it("points at production and carries the spec's limits", () => {
    expect(API_BASE).toBe("https://api.dosya.dev");
    expect(APP_BASE).toBe("https://app.dosya.dev");
    expect(MAX_UPLOAD_BYTES).toBe(52428800);
    expect(MAX_SELECTION_CHARS).toBe(1000000);
  });
  it("names the client from the build target and the user agent", () => {
    expect(currentClient({ target: "firefox", userAgent: "x" })).toBe("firefox");
    expect(currentClient({ target: "chrome", userAgent: "Mozilla/5.0 Chrome/130 Edg/130" })).toBe("edge");
    expect(currentClient({ target: "chrome", userAgent: "Mozilla/5.0 Chrome/130" })).toBe("chrome");
  });
});
