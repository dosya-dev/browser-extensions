// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import ShareDialog from "./ShareDialog";
import type { SaveItem } from "../../../lib/messages";

const sendMock = vi.fn();
vi.mock("../../../lib/messages", () => ({ send: (m: unknown) => sendMock(m) }));

const item = { id: "1", filename: "a.jpg", bytes: 1000, state: "done", kind: "image", fileId: "f1" } as unknown as SaveItem;

async function render() {
  const el = document.createElement("div"); document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(<ShareDialog item={item} onClose={() => {}} />); });
  return el;
}
const click = async (el: HTMLElement, name: string) => {
  const b = Array.from(el.querySelectorAll("button")).find((x) => x.textContent?.includes(name))!;
  await act(async () => { b.click(); await new Promise((r) => setTimeout(r, 0)); });
};

describe("share dialog", () => {
  beforeEach(() => { sendMock.mockReset(); document.body.innerHTML = ""; });

  it("copies through writeText where ClipboardItem is missing and says Copied", async () => {
    const writeText = vi.fn(async () => {}); Object.assign(navigator, { clipboard: { writeText } });
    sendMock.mockResolvedValue({ url: "https://dosya.dev/s/abc" });
    const el = await render();
    await click(el, "Copy link");
    expect(writeText).toHaveBeenCalledWith("https://dosya.dev/s/abc");
    expect(el.textContent).toContain("Copied");
  });

  it("offers a Copy button that succeeds on a fresh click after Safari refused the first", async () => {
    // The first attempt is refused because the link had to be fetched first and
    // Safari treats that click's permission as spent. The second click has the
    // link already, so it is allowed.
    const writeText = vi.fn<(t: string) => Promise<void>>(async () => { throw new Error("NotAllowedError"); });
    Object.assign(navigator, { clipboard: { writeText } });
    sendMock.mockResolvedValue({ url: "https://dosya.dev/s/abc" });
    const el = await render();
    await click(el, "Copy link");
    expect((el.querySelector("input[aria-label='Share link']") as HTMLInputElement).value).toBe("https://dosya.dev/s/abc");
    writeText.mockImplementation(async () => {});
    await click(el, "Copy");
    expect(writeText).toHaveBeenLastCalledWith("https://dosya.dev/s/abc");
    expect(el.textContent).toContain("Copied");
  });

  it("shows the link for a manual copy when the browser refuses the clipboard", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => { throw new Error("not allowed"); }) } });
    sendMock.mockResolvedValue({ url: "https://dosya.dev/s/abc" });
    const el = await render();
    await click(el, "Copy link");
    expect(el.querySelector("[role=alert]")?.textContent).toContain("would not let that click reach the clipboard");
    expect((el.querySelector("input[aria-label='Share link']") as HTMLInputElement).value).toBe("https://dosya.dev/s/abc");
  });

  it("disables the button and shows the spinner while the link is being made, and ignores a second click", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
    let resolve!: (v: { url: string }) => void;
    sendMock.mockImplementation(() => new Promise<{ url: string }>((r) => { resolve = r; }));
    const el = await render();
    const btn = Array.from(el.querySelectorAll("button")).find((x) => x.textContent?.includes("Copy link"))!;
    await act(async () => { btn.click(); });
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain("Creating link");
    expect(btn.getAttribute("aria-busy")).toBe("true");
    await act(async () => { btn.click(); });
    expect(sendMock).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ url: "https://dosya.dev/s/abc" }); await new Promise((r) => setTimeout(r, 0)); });
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toContain("Copied");
  });

  it("says so when the link could not be created", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
    sendMock.mockResolvedValue({ ok: false });
    const el = await render();
    await click(el, "Copy link");
    expect(el.querySelector("[role=alert]")?.textContent).toContain("Could not create a link");
    expect(el.querySelector("input[aria-label='Share link']")).toBeNull();
  });
});
