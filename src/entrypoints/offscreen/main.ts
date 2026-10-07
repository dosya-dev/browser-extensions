import { browser } from "wxt/browser";
import { createClient } from "../../lib/api/client";
import { runUpload, type UploadResult } from "../../lib/upload/one-shot";
import { getItem, getBlob } from "../../lib/store/items";
import type { Message } from "../../lib/messages";

const HEARTBEAT_MS = 20_000;
/** Every message into the worker resets its idle timer, so a long upload keeps it alive. */
const tell = (m: Message) => void browser.runtime.sendMessage(m).catch(() => undefined);
function resultMessage(itemId: string, r: UploadResult): Message {
  if (r.kind === "done") return { type: "upload-done", itemId, fileId: r.fileId };
  if (r.kind === "retry") return { type: "upload-failed", itemId, status: 0, message: r.message, retryAfterS: r.afterMs / 1000 };
  return { type: "upload-failed", itemId, status: -1, message: r.message, retryAfterS: null };
}

browser.runtime.onMessage.addListener((msg: { type?: string; itemId?: string; accessToken?: string | null }, _s, sendResponse) => {
  if (msg?.type !== "upload" || !msg.itemId) return;
  const itemId = msg.itemId;
  (async () => {
    let token = msg.accessToken ?? null;
    const client = createClient({
      get: async () => token,
      refresh: async () => { const r = (await browser.runtime.sendMessage({ type: "token-expired" })) as { accessToken: string | null }; token = r.accessToken; return token; },
    });
    const item = await getItem(itemId);
    if (!item) { sendResponse({ kind: "failed", message: "Capture is gone" }); return; }
    const beat = setInterval(() => tell({ type: "upload-progress", itemId, bytes: 0 }), HEARTBEAT_MS);
    let result: UploadResult;
    try { result = await runUpload(item, { client, getBlob }); }
    finally { clearInterval(beat); }
    // The worker may have been killed while this ran, so the outcome is also sent as a
    // message; the background applies whichever arrives first and ignores the other.
    tell(resultMessage(itemId, result));
    sendResponse(result);
  })();
  return true;
});
