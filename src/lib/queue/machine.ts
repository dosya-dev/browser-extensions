import type { SaveItem } from "../messages";
import type { UploadResult } from "../upload/one-shot";
export function applyResult(item: SaveItem, r: UploadResult, now: number): Partial<SaveItem> {
  if (r.kind === "done") return { state: "done", fileId: r.fileId, message: null };
  if (r.kind === "retry") return { state: "queued", attempts: item.attempts + 1, nextAttemptAt: now + r.afterMs, message: r.message };
  return { state: "failed", message: r.message };
}
export function pickRunnable(items: SaveItem[], now: number, running: Set<string>, max = 2): SaveItem[] {
  return items.filter((i) => i.state === "queued" && i.nextAttemptAt <= now && !running.has(i.id)).sort((a, b) => a.createdAt - b.createdAt).slice(0, Math.max(0, max - running.size));
}
