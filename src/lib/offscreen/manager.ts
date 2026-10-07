import { browser } from "wxt/browser";
import type { SaveItem } from "../messages";
import type { UploadResult } from "../upload/one-shot";
const URL_PATH = "/offscreen.html";
export async function ensureOffscreen(): Promise<void> {
  const off = (browser as unknown as { offscreen?: { createDocument(p: { url: string; reasons: string[]; justification: string }): Promise<void> } }).offscreen;
  if (!off) return;
  const url = browser.runtime.getURL(URL_PATH);
  const getContexts = (browser.runtime as unknown as { getContexts?: (f: { contextTypes: string[]; documentUrls: string[] }) => Promise<unknown[]> }).getContexts;
  if (getContexts && (await getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [url] })).length > 0) return;
  try { await off.createDocument({ url: URL_PATH, reasons: ["BLOBS"], justification: "Uploads captured files to dosya without the service worker's idle limit" }); }
  catch (e) { if (!String(e).includes("single offscreen")) throw e; }
}
export async function closeOffscreen(): Promise<void> {
  const off = (browser as unknown as { offscreen?: { closeDocument(): Promise<void> } }).offscreen;
  await off?.closeDocument().catch(() => undefined);
}
export async function uploadViaOffscreen(item: SaveItem, accessToken: string | null): Promise<UploadResult> {
  await ensureOffscreen();
  return (await browser.runtime.sendMessage({ type: "upload", itemId: item.id, accessToken })) as UploadResult;
}
