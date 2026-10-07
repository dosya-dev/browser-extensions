import type { SaveItem } from "../messages";
import { listItems, updateItem, getItem, deleteBlob, requeueUploading } from "../store/items";
import { backoffMs, type UploadResult } from "../upload/one-shot";
import { applyResult, pickRunnable } from "./machine";
export function badgeText(items: SaveItem[]): string { const n = items.filter((i) => i.state === "queued" || i.state === "uploading").length; return n ? String(n) : ""; }
export function createRunner(deps: { executor(item: SaveItem): Promise<UploadResult>; now?: () => number; onChange?: () => void }) {
  const now = deps.now ?? (() => Date.now());
  const running = new Set<string>();
  async function runOne(item: SaveItem): Promise<void> {
    // no await may sit between pickRunnable and this line
    running.add(item.id);
    try {
      await updateItem(item.id, { state: "uploading" });
      let result: UploadResult | undefined;
      try { result = await deps.executor(item); }
      catch { result = undefined; }
      const current = (await getItem(item.id)) ?? item;
      // The offscreen document reports its result twice (reply and message); whichever path
      // applied it first moved the row off "uploading", so the other one must not apply again.
      if (current.state !== "uploading") return;
      const outcome: UploadResult = result ?? { kind: "retry", afterMs: backoffMs(current.attempts), message: "Upload interrupted" };
      await updateItem(item.id, applyResult(current, outcome, now()));
      if (outcome.kind === "done") await deleteBlob(item.id);
    } finally { running.delete(item.id); deps.onChange?.(); }
  }
  return {
    running,
    async tick(): Promise<void> {
      const due = pickRunnable(await listItems(), now(), running);
      await Promise.all(due.map(runOne));
    },
    async recoverOnStartup(): Promise<number> { const n = await requeueUploading(now()); deps.onChange?.(); return n; },
  };
}
