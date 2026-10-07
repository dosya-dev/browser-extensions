import { browser } from "wxt/browser";
import { MAX_UPLOAD_BYTES } from "../lib/config";
import { readCapped, classifyFetchFailure } from "../lib/capture/stream-cap";
import { CHUNK, encodeChunk } from "../lib/capture/chunks";
import { sha256Hex } from "../lib/pkce";
import { truncateSelection } from "../lib/capture/selection";
export default defineContentScript({
  matches: ["<all_urls>"],
  registration: "runtime",
  main() {
    const g = globalThis as { __dosyaPageScript?: boolean };
    if (g.__dosyaPageScript) return;
    g.__dosyaPageScript = true;
    browser.runtime.onMessage.addListener((msg: { type?: string }, _sender, sendResponse) => {
      if (msg?.type !== "page-selection") return;
      sendResponse({ text: truncateSelection(window.getSelection()?.toString() ?? ""), title: document.title, url: location.href });
      return true;
    });
    browser.runtime.onConnect.addListener((port) => {
      if (port.name !== "page-image") return;
      const ac = new AbortController();
      let disconnected = false;
      const post = (msg: unknown) => { if (!disconnected) port.postMessage(msg); };
      port.onDisconnect.addListener(() => { disconnected = true; ac.abort(); });
      port.onMessage.addListener(async (m: { url: string }) => {
        try {
          const res = await fetch(m.url, { credentials: "omit", signal: ac.signal });
          if (res.type === "opaque" || !res.ok) { post({ error: "opaque" }); return; }
          const blob = await readCapped(res, MAX_UPLOAD_BYTES, ac);
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const sha256 = await sha256Hex(bytes);
          for (let i = 0, index = 0; i < bytes.length; i += CHUNK, index++) {
            post({ index, b64: encodeChunk(bytes.subarray(i, i + CHUNK)) });
          }
          post({ done: true, sha256, contentType: blob.type });
        } catch (e) { post({ error: classifyFetchFailure(e, navigator.onLine) }); }
      });
    });
  },
});
