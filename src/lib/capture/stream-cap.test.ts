// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readCapped, TooLargeError, classifyFetchFailure } from "./stream-cap";
function streamOf(chunks: Uint8Array[], headers: Record<string, string> = {}) {
  let i = 0;
  const body = new ReadableStream<Uint8Array>({ pull(c) { if (i < chunks.length) c.enqueue(chunks[i++]); else c.close(); } });
  return new Response(body, { headers });
}
describe("readCapped", () => {
  it("returns the bytes under the cap with the content type", async () => {
    const b = await readCapped(streamOf([new Uint8Array([1, 2]), new Uint8Array([3])], { "content-type": "image/png" }), 10);
    expect(b.size).toBe(3); expect(b.type).toBe("image/png");
  });
  it("refuses a declared Content-Length over the cap before reading", async () => {
    const res = streamOf([], { "content-length": "11" });
    await expect(readCapped(res, 10)).rejects.toBeInstanceOf(TooLargeError);
  });
  it("aborts an undeclared stream the moment it passes the cap", async () => {
    const big = new Uint8Array(4);
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({ pull(c) { pulls++; c.enqueue(big); } });
    const ac = new AbortController();
    await expect(readCapped(new Response(body), 10, ac)).rejects.toBeInstanceOf(TooLargeError);
    expect(ac.signal.aborted).toBe(true);
    expect(pulls).toBeLessThanOrEqual(4);
  });
});
describe("classifyFetchFailure", () => {
  it("maps TooLargeError to too-large regardless of online state", () => {
    expect(classifyFetchFailure(new TooLargeError(10), true)).toBe("too-large");
    expect(classifyFetchFailure(new TooLargeError(10), false)).toBe("too-large");
  });
  it("maps a thrown fetch error to opaque while online", () => {
    expect(classifyFetchFailure(new TypeError("Failed to fetch"), true)).toBe("opaque");
  });
  it("maps the same error to network while offline", () => {
    expect(classifyFetchFailure(new TypeError("Failed to fetch"), false)).toBe("network");
  });
});
