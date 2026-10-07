export class TooLargeError extends Error { constructor(public limit: number) { super(`larger than ${limit} bytes`); } }
export async function readCapped(res: Response, max: number, controller?: AbortController): Promise<Blob> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > max) { controller?.abort(); throw new TooLargeError(max); }
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!res.body) { const buf = await res.arrayBuffer(); if (buf.byteLength > max) throw new TooLargeError(max); return new Blob([buf], { type }); }
  const reader = res.body.getReader(); const parts: Uint8Array[] = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { controller?.abort(); await reader.cancel().catch(() => undefined); throw new TooLargeError(max); }
    parts.push(value);
  }
  return new Blob(parts as BlobPart[], { type });
}
export function classifyFetchFailure(err: unknown, online: boolean): "too-large" | "opaque" | "network" {
  if (err instanceof TooLargeError) return "too-large";
  return online ? "opaque" : "network";
}
