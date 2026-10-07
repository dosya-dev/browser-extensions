import { ApiError, type Client } from "../api/client";
import { uploadOneShot } from "../api/routes";
import type { SaveItem } from "../messages";
export type UploadResult = { kind: "done"; fileId: string } | { kind: "retry"; afterMs: number; message: string } | { kind: "failed"; message: string };
export const MAX_BACKOFF_MS = 300_000;
export function backoffMs(attempts: number): number { return Math.min(2000 * 2 ** attempts, MAX_BACKOFF_MS); }
function serverMessage(body: string, fallback: string): string { try { const j = JSON.parse(body) as { error?: string }; return j.error || fallback; } catch { return fallback; } }
export async function runUpload(item: SaveItem, deps: { client: Client; getBlob(id: string): Promise<Blob | null>; signal?: AbortSignal }): Promise<UploadResult> {
  const blob = await deps.getBlob(item.id);
  if (!blob) return { kind: "failed", message: "Capture is gone" };
  try {
    const r = await uploadOneShot(deps.client, { workspaceId: item.workspaceId, folderId: item.folderId, filename: item.filename, blob, sha256: item.sha256, idempotencyKey: item.id, signal: deps.signal });
    return { kind: "done", fileId: r.fileId };
  } catch (e) {
    if (!(e instanceof ApiError)) return { kind: "retry", afterMs: backoffMs(item.attempts), message: "Waiting for network" };
    if (e.status === 429) return { kind: "retry", afterMs: (e.retryAfterS ?? 30) * 1000, message: "Rate limited" };
    if (e.status === 409) return { kind: "retry", afterMs: (e.retryAfterS ?? 5) * 1000, message: "Finishing an earlier attempt" };
    if (e.status === 503 || e.status === 0) return { kind: "retry", afterMs: backoffMs(item.attempts), message: "Waiting for network" };
    if (e.status === 401) return { kind: "failed", message: "Signed out" };
    return { kind: "failed", message: serverMessage(e.body, `Upload refused (${e.status})`) };
  }
}
