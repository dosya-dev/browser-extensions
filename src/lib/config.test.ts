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
    // Safari wraps the same Chromium build in a Mac app, and its user agent is
    // the one that says Safari without Chrome. Reported as "chrome" until
    // 2026-10-08, which put the word Chrome on a Safari user's consent page.
    expect(
      currentClient({
        target: "chrome",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15",
      }),
    ).toBe("safari");
    // Chrome's own user agent also carries "Safari/", so it must not be read as Safari.
    expect(
      currentClient({
        target: "chrome",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      }),
    ).toBe("chrome");
  });
});
