// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { copyNow, copyViaSelection } from "./clipboard";

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

describe("copying text that is already known", () => {
  it("uses the clipboard API when it is allowed", async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    expect(await copyNow("https://dosya.dev/s/abc")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://dosya.dev/s/abc");
  });

  it("falls back to the selection when Safari refuses the clipboard API", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => { throw new Error("NotAllowedError"); }) } });
    const exec = vi.fn(() => true);
    Object.assign(document, { execCommand: exec });
    expect(await copyNow("https://dosya.dev/s/abc")).toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("reports failure rather than claiming a copy that did not happen", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => { throw new Error("no"); }) } });
    Object.assign(document, { execCommand: vi.fn(() => false) });
    expect(await copyNow("x")).toBe(false);
  });

  it("leaves no field behind, even when the copy throws", () => {
    Object.assign(document, { execCommand: vi.fn(() => { throw new Error("boom"); }) });
    expect(copyViaSelection("x")).toBe(false);
    expect(document.querySelectorAll("textarea").length).toBe(0);
  });
});
