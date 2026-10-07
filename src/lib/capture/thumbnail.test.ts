// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import { makeThumbnail, bytesToDataUrl } from "./thumbnail";

const g = globalThis as { createImageBitmap?: unknown; OffscreenCanvas?: unknown };
const saved = { cib: g.createImageBitmap, oc: g.OffscreenCanvas };
afterEach(() => { g.createImageBitmap = saved.cib; g.OffscreenCanvas = saved.oc; });

describe("thumbnails", () => {
  it("encodes bytes as a data url", () => {
    expect(bytesToDataUrl(new Uint8Array([104, 105]).buffer, "text/plain")).toBe("data:text/plain;base64,aGk=");
  });
  it("gives up quietly where the platform cannot draw", async () => {
    g.createImageBitmap = undefined; g.OffscreenCanvas = undefined;
    expect(await makeThumbnail(new Blob([new Uint8Array(4)], { type: "image/png" }))).toBeUndefined();
  });
  it("gives up quietly when the image cannot be decoded", async () => {
    g.createImageBitmap = async () => { throw new Error("not an image"); };
    g.OffscreenCanvas = class {};
    expect(await makeThumbnail(new Blob(["<svg/>"], { type: "image/svg+xml" }))).toBeUndefined();
  });
  it("cover-crops to a square jpeg data url", async () => {
    const calls: unknown[][] = [];
    g.createImageBitmap = async () => ({ width: 200, height: 100, close() {} });
    g.OffscreenCanvas = class { constructor(public w: number, public h: number) {} getContext() { return { drawImage: (...a: unknown[]) => calls.push(a) }; } async convertToBlob() { return new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }); } };
    const url = await makeThumbnail(new Blob([new Uint8Array(4)], { type: "image/png" }), 72);
    expect(url).toBe("data:image/jpeg;base64,AQID");
    // source crop: 100x100 square from the middle of the 200x100 bitmap, drawn at 72x72
    expect(calls[0]!.slice(1)).toEqual([50, 0, 100, 100, 0, 0, 72, 72]);
  });
});
