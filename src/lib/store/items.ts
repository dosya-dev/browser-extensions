import { withStore, request } from "./db";
import type { SaveItem } from "../messages";
const DAY = 86_400_000;
export const ITEM_RETENTION_MS = 30 * DAY;
export const FAILED_BLOB_RETENTION_MS = 7 * DAY;
export const CAPTURE_STALE_MS = 10 * 60_000;
export const UPLOAD_STALE_MS = 10 * 60_000;
export const putItem = (item: SaveItem) => withStore("items", "readwrite", (s) => request(s.put(item)).then(() => undefined));
export const getItem = (id: string) => withStore("items", "readonly", (s) => request(s.get(id)).then((v) => (v as SaveItem | undefined) ?? null));
export const listItems = () => withStore("items", "readonly", (s) => request(s.getAll()).then((v) => (v as SaveItem[]).sort((a, b) => b.createdAt - a.createdAt)));
export const listByState = (state: SaveItem["state"]) => withStore("items", "readonly", (s) => request(s.index("by_state").getAll(state)).then((v) => v as SaveItem[]));
export async function updateItem(id: string, patch: Partial<SaveItem>): Promise<SaveItem | null> {
  return withStore("items", "readwrite", async (s) => {
    const cur = (await request(s.get(id))) as SaveItem | undefined;
    if (!cur) return null;
    const next = { ...cur, ...patch, updatedAt: Math.max(Date.now(), cur.updatedAt + 1) };
    await request(s.put(next)); return next;
  });
}
export const deleteItem = (id: string) => withStore("items", "readwrite", (s) => request(s.delete(id)).then(() => undefined));
export const putBlob = (id: string, blob: Blob) => withStore("blobs", "readwrite", (s) => request(s.put({ id, blob })).then(() => undefined));
export const getBlob = (id: string) => withStore("blobs", "readonly", (s) => request(s.get(id)).then((v) => (v as { blob: Blob } | undefined)?.blob ?? null));
export const deleteBlob = (id: string) => withStore("blobs", "readwrite", (s) => request(s.delete(id)).then(() => undefined));
/** Drops every capture and its bytes, for sign-out. */
export async function clearAll(): Promise<void> {
  await withStore("items", "readwrite", (s) => request(s.clear()).then(() => undefined));
  await withStore("blobs", "readwrite", (s) => request(s.clear()).then(() => undefined));
}
export async function requeueUploading(now: number): Promise<number> {
  const stuck = (await listByState("uploading")).filter((i) => now - i.updatedAt > UPLOAD_STALE_MS);
  for (const i of stuck) await updateItem(i.id, { state: "queued", nextAttemptAt: now });
  return stuck.length;
}
export async function sweepItems(now: number): Promise<{ itemsDeleted: number; blobsDeleted: number; itemsFailed: number; itemsRequeued: number }> {
  let itemsDeleted = 0, blobsDeleted = 0, itemsFailed = 0, itemsRequeued = 0;
  for (const i of await listItems()) {
    if (now - i.createdAt > ITEM_RETENTION_MS) { await deleteBlob(i.id); await deleteItem(i.id); itemsDeleted++; continue; }
    if (i.state === "failed" && now - i.updatedAt > FAILED_BLOB_RETENTION_MS && (await getBlob(i.id))) { await deleteBlob(i.id); blobsDeleted++; continue; }
    if (i.state === "captured" && now - i.createdAt > CAPTURE_STALE_MS) {
      // A capture that never got enqueued but still has its bytes is work, not garbage.
      if (await getBlob(i.id)) { await updateItem(i.id, { state: "queued", nextAttemptAt: now }); itemsRequeued++; }
      else { await updateItem(i.id, { state: "failed", message: "Capture is gone" }); itemsFailed++; }
    }
  }
  const remainingIds = new Set((await listItems()).map((i) => i.id));
  const blobKeys = await withStore("blobs", "readonly", (s) => request(s.getAllKeys()));
  for (const key of blobKeys as string[]) {
    if (!remainingIds.has(key)) { await deleteBlob(key); blobsDeleted++; }
  }
  return { itemsDeleted, blobsDeleted, itemsFailed, itemsRequeued };
}
