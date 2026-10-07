// @vitest-environment node
import { describe, it, expect } from "vitest";
import { captureScreenshot, captureSelection, captureImage } from "./capture";
import { getItem, getBlob } from "../store/items";
const dest = { workspaceId: "ws", workspaceName: "Personal", folderId: "fo", folderName: "Autumn" };
const PNG = "data:image/png;base64,iVBORw0KGgo=";
describe("capture", () => {
  it("screenshot: stores a png blob and an item with a dated filename and a uuid id", async () => {
    const item = await captureScreenshot({ captureTab: async () => PNG, activeTab: async () => ({ title: "Studio", url: "https://x/y" }), destination: dest, now: new Date(2026, 9, 7, 9, 5).getTime() });
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/); expect(item.filename).toBe("Studio 2026-10-07 09.05.png"); expect(item.kind).toBe("screenshot"); expect(item.state).toBe("queued");
    expect(item.sha256).toMatch(/^[0-9a-f]{64}$/); expect(item.bytes).toBe(8);
    expect(item.folderName).toBe("Autumn");
    expect((await getItem(item.id))?.workspaceId).toBe("ws"); expect((await getBlob(item.id))?.type).toBe("image/png");
    expect((await getItem(item.id))?.state).toBe("queued");
  });
  it("two captures at once produce two stored items with distinct ids (Review Focus 3)", async () => {
    const deps = { captureTab: async () => PNG, activeTab: async () => ({ title: "S", url: "https://x" }), destination: dest };
    const [a, b] = await Promise.all([captureScreenshot(deps), captureScreenshot(deps)]);
    expect(a.id).not.toBe(b.id);
    expect(await getItem(a.id)).not.toBeNull(); expect(await getItem(b.id)).not.toBeNull();
    expect(await getBlob(a.id)).not.toBeNull(); expect(await getBlob(b.id)).not.toBeNull();
  });
  it("selection: formats the text file; an empty selection stores nothing", async () => {
    const item = await captureSelection({ askPage: async () => ({ text: "hi", title: "T", url: "https://x" }), destination: dest });
    expect("empty" in item).toBe(false);
    if (!("empty" in item)) { expect(item.filename).toBe("T.txt"); expect(await (await getBlob(item.id))?.text()).toBe("Title: T\nSource: https://x\n\nhi"); }
    expect(await captureSelection({ askPage: async () => ({ text: "   ", title: "T", url: "u" }), destination: dest })).toEqual({ empty: true });
  });
  it("image: background fetch first; page fallback when the background response is opaque; blocked when both fail", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const okRes = () => new Response(bytes, { headers: { "content-type": "image/jpeg" } });
    const a = await captureImage({ imageUrl: "https://cdn/x/pic.jpg", pageTitle: "P", pageUrl: "https://p", destination: dest, fetchBackground: async () => okRes(), fetchViaPage: async () => { throw new Error("not called"); } });
    expect("error" in a).toBe(false); if (!("error" in a)) expect(a.filename).toBe("pic.jpg");
    const viaPage = { bytes, sha256: "aa".repeat(32), contentType: "image/jpeg" };
    const b = await captureImage({ imageUrl: "https://cdn/x/pic", pageTitle: "P", pageUrl: "https://p", destination: dest, fetchBackground: async () => { throw new TypeError("cors"); }, fetchViaPage: async () => viaPage });
    expect("error" in b).toBe(false); if (!("error" in b)) { expect(b.filename).toBe("P.jpg"); expect(b.sha256).toBe("aa".repeat(32)); }
    const c = await captureImage({ imageUrl: "https://cdn/x/pic", pageTitle: "P", pageUrl: "https://p", destination: dest, fetchBackground: async () => { throw new TypeError("cors"); }, fetchViaPage: async () => { throw new Error("opaque"); } });
    expect(c).toEqual({ error: "blocked" });
  });
});
