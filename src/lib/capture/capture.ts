import { MAX_UPLOAD_BYTES } from "../config";
import type { Destination, SaveItem } from "../messages";
import { putItem, putBlob, updateItem } from "../store/items";
import { sha256Hex } from "../pkce";
import { imageFilename, screenshotFilename, selectionFilename } from "./filename";
import { selectionText } from "./selection";
import { dataUrlToBlob } from "./screenshot";
import { readCapped, TooLargeError } from "./stream-cap";
import { makeThumbnail } from "./thumbnail";

export async function newItem(p: { kind: SaveItem["kind"]; filename: string; sourceUrl: string; sourceTitle: string; destination: Destination; blob: Blob; sha256?: string; now?: number }): Promise<SaveItem> {
  const now = p.now ?? Date.now();
  const sha256 = p.sha256 ?? (await sha256Hex(await p.blob.arrayBuffer()));
  const thumb = p.kind === "selection" ? undefined : await makeThumbnail(p.blob);
  const item: SaveItem = { id: crypto.randomUUID(), filename: p.filename, state: "captured", kind: p.kind, sourceUrl: p.sourceUrl, sourceTitle: p.sourceTitle,
    workspaceId: p.destination.workspaceId, folderId: p.destination.folderId, folderName: p.destination.folderName, sha256, bytes: p.blob.size, createdAt: now, updatedAt: now, fileId: null, message: null, attempts: 0, nextAttemptAt: now,
    ...(thumb ? { thumb } : {}) };
  await putItem(item);
  await putBlob(item.id, p.blob);
  return (await updateItem(item.id, { state: "queued" })) ?? { ...item, state: "queued" };
}
export async function captureScreenshot(d: { captureTab(): Promise<string>; activeTab(): Promise<{ title: string; url: string }>; destination: Destination; now?: number }): Promise<SaveItem> {
  const [dataUrl, tab] = await Promise.all([d.captureTab(), d.activeTab()]);
  const now = d.now ?? Date.now();
  return newItem({ kind: "screenshot", filename: screenshotFilename(tab.title, new Date(now)), sourceUrl: tab.url, sourceTitle: tab.title, destination: d.destination, blob: dataUrlToBlob(dataUrl), now });
}
export async function captureSelection(d: { askPage(): Promise<{ text: string; title: string; url: string }>; destination: Destination; now?: number }): Promise<SaveItem | { empty: true }> {
  const sel = await d.askPage();
  if (!sel.text.trim()) return { empty: true };
  const blob = new Blob([selectionText(sel)], { type: "text/plain" });
  return newItem({ kind: "selection", filename: selectionFilename(sel.title), sourceUrl: sel.url, sourceTitle: sel.title, destination: d.destination, blob, now: d.now });
}
export async function captureImage(d: { imageUrl: string; pageTitle: string; pageUrl: string; destination: Destination; fetchBackground(url: string): Promise<Response>; fetchViaPage(url: string): Promise<{ bytes: Uint8Array; sha256: string; contentType: string }>; now?: number }): Promise<SaveItem | { error: "too-large" | "blocked" }> {
  let blob: Blob | null = null; let sha256: string | undefined;
  try {
    const res = await d.fetchBackground(d.imageUrl);
    if (res.ok && res.type !== "opaque") blob = await readCapped(res, MAX_UPLOAD_BYTES);
  } catch (e) { if (e instanceof TooLargeError) return { error: "too-large" }; }
  if (!blob) {
    try { const r = await d.fetchViaPage(d.imageUrl); blob = new Blob([r.bytes as BlobPart], { type: r.contentType }); sha256 = r.sha256; }
    catch (e) { return { error: e instanceof TooLargeError ? "too-large" : "blocked" }; }
  }
  return newItem({ kind: "image", filename: imageFilename(d.imageUrl, blob.type || null, d.pageTitle), sourceUrl: d.pageUrl, sourceTitle: d.pageTitle, destination: d.destination, blob, sha256, now: d.now });
}
