import { sha256Hex } from "../pkce";
export const CHUNK = 512 * 1024;
export function encodeChunk(piece: Uint8Array): string { let s = ""; for (let i = 0; i < piece.length; i += 0x8000) s += String.fromCharCode(...piece.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(s: string): Uint8Array { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
export function encodeChunks(bytes: Uint8Array): string[] { const out: string[] = []; for (let i = 0; i < bytes.length; i += CHUNK) out.push(encodeChunk(bytes.subarray(i, i + CHUNK))); return out; }
export function decodeChunks(pieces: string[]): Uint8Array {
  const parts = pieces.map(unb64); const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; } return out;
}
export class ChunkAssembler {
  private pieces = new Map<number, string>();
  push(index: number, piece: string): void { this.pieces.set(index, piece); }
  async finish(expectedSha256: string): Promise<Uint8Array> {
    const ordered: string[] = [];
    for (let i = 0; i < this.pieces.size; i++) { const p = this.pieces.get(i); if (p === undefined) throw new Error(`missing chunk ${i}`); ordered.push(p); }
    const bytes = decodeChunks(ordered);
    if ((await sha256Hex(bytes)) !== expectedSha256) throw new Error("hash mismatch after transfer");
    return bytes;
  }
}
