// @vitest-environment node
import { describe, it, expect } from "vitest";
import { encodeChunks, decodeChunks, ChunkAssembler, CHUNK } from "./chunks";
import { sha256Hex } from "../pkce";
describe("chunks", () => {
  it("round-trips bytes through 512 KB base64 pieces", () => {
    // crypto.getRandomValues caps at 65536 bytes per call (WebCrypto spec, not a Node quirk); fill in batches.
    const bytes = new Uint8Array(CHUNK * 2 + 17);
    for (let i = 0; i < bytes.length; i += 65536) crypto.getRandomValues(bytes.subarray(i, i + 65536));
    const pieces = encodeChunks(bytes);
    expect(pieces.length).toBe(3);
    expect(decodeChunks(pieces)).toEqual(bytes);
  });
  it("assembler accepts out-of-order pieces and verifies the hash", async () => {
    const bytes = new TextEncoder().encode("hello world"); const pieces = encodeChunks(bytes);
    const a = new ChunkAssembler(); pieces.forEach((p, i) => a.push(pieces.length - 1 - i, pieces[pieces.length - 1 - i]));
    expect(await a.finish(await sha256Hex(bytes))).toEqual(bytes);
    const bad = new ChunkAssembler(); bad.push(0, pieces[0]);
    await expect(bad.finish("00")).rejects.toThrow(/hash/);
    const gap = new ChunkAssembler(); gap.push(1, pieces[0]);
    await expect(gap.finish(await sha256Hex(bytes))).rejects.toThrow(/missing/);
  });
});
