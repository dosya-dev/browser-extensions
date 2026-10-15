import { browser } from "wxt/browser";
import { currentClient } from "../lib/config";
import { createClient } from "../lib/api/client";
import { createRefresher } from "../lib/auth/refresh";
import { loadTokens } from "../lib/store/auth-store";
import { deleteBlob, getBlob, getItem, listItems, sweepItems, updateItem } from "../lib/store/items";
import { createRunner, badgeText } from "../lib/queue/runner";
import { applyOffscreenMessage, type OffscreenMessage } from "../lib/queue/offscreen-results";
import { getAnimations } from "../lib/store/prefs";
import { runUpload } from "../lib/upload/one-shot";
import { uploadViaOffscreen } from "../lib/offscreen/manager";
import { createHandlers } from "../lib/background/handlers";
import { installMenus, MENU } from "../lib/background/menus";
import { startSignIn } from "../lib/auth/sign-in";
import { ChunkAssembler } from "../lib/capture/chunks";
import { TooLargeError } from "../lib/capture/stream-cap";
import type { Message, SaveItem } from "../lib/messages";

function reason(code: string): string {
  switch (code) {
    case "no-selection": return "Select some text first";
    case "no-workspace": return "No workspace to save into";
    case "no-page": return "This page cannot be captured";
    case "too-large": return "Larger than 50 MB";
    case "blocked": return "This site blocks saving; allow it in the popup";
    default: return code;
  }
}

export default defineBackground(() => {
  const refresher = createRefresher();
  const isFirefox = import.meta.env.BROWSER === "firefox";
  // Safari ships the Chromium build but has neither offscreen documents nor notifications:
  // uploads then run on the background itself (the Firefox path) and results show in the popup.
  const hasOffscreen = typeof (browser as { offscreen?: unknown }).offscreen !== "undefined";
  const uploadDirectly = isFirefox || !hasOffscreen;
  const notify = async (title: string, message: string) => {
    const n = (browser as { notifications?: { create(o: { type: "basic"; iconUrl: string; title: string; message: string }): Promise<string> } }).notifications;
    if (!n) return;
    await n.create({ type: "basic", iconUrl: browser.runtime.getURL("/icon/128.png"), title, message });
  };
  const client = createClient({
    get: async () => (await loadTokens())?.accessToken ?? null,
    // A refresh that cannot be renewed means the session is over; saying so beats silence.
    refresh: async () => {
      const t = await refresher.refresh();
      if (!t) await notify("Signed out of dosya", "Sign in again from the popup");
      return t;
    },
  });
  async function report(p: Promise<{ ok: boolean; error?: string }>) {
    try {
      const r = await p;
      if (!r.ok && r.error && r.error !== "signed-out") await notify("Could not save", reason(r.error));
    } catch (e) { await notify("Could not save", String(e)); }
  }
  /** A save is reported once, whichever of the two offscreen result paths arrives first. */
  const notified = new Set<string>();
  function notifySaved(itemId: string, filename: string, thumb?: string) {
    if (notified.has(itemId)) return;
    notified.add(itemId);
    void notify("Saved to dosya", filename);
    void flyOnPage(itemId, thumb);
  }
  /** The tab each capture came from, noted while its permission grant was live. */
  const captureTabs = new Map<string, number>();
  /**
   * Draws the flight in the tab the capture came from.
   *
   * Messaging a content script that is ALREADY running needs no permission, so
   * this tries that first: the script was injected at capture time, back when
   * the click's `activeTab` grant was live. Injecting here is only a fallback
   * for a tab that lost its script, and it is the step Safari refuses once the
   * grant has lapsed. Best effort throughout: a tab that cannot take the script
   * (a store page, a PDF) simply shows nothing.
   */
  async function flyOnPage(itemId: string, thumb?: string) {
    const noted = captureTabs.get(itemId);
    captureTabs.delete(itemId);
    try {
      if (!(await getAnimations())) return;
      let tabId = noted;
      if (typeof tabId !== "number") {
        const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
        tabId = tab?.id;
      }
      if (typeof tabId !== "number") return;
      const play = () => browser.tabs.sendMessage(tabId as number, { type: "play-save", thumb });
      try {
        await play();
      } catch {
        await ensurePageScript(tabId);
        await play();
      }
    } catch { /* no page to draw on */ }
  }
  async function executor(item: SaveItem) {
    if (!uploadDirectly) {
      const r = await uploadViaOffscreen(item, (await loadTokens())?.accessToken ?? null);
      if (r.kind === "done") notifySaved(item.id, item.filename, item.thumb);
      return r;
    }
    const keepalive = setInterval(() => { void browser.runtime.getPlatformInfo(); }, 20_000);
    try {
      const r = await runUpload(item, { client, getBlob });
      if (r.kind === "done") notifySaved(item.id, item.filename, item.thumb);
      return r;
    } finally { clearInterval(keepalive); }
  }
  const setBadge = async (text: string) => { await browser.action.setBadgeText({ text }); await browser.action.setBadgeBackgroundColor({ color: "#16a34a" }); };
  const runner = createRunner({ executor, onChange: async () => { setBadge(badgeText(await listItems())); } });
  async function ensurePageScript(tabId: number) { await browser.scripting.executeScript({ target: { tabId }, files: ["/content-scripts/page.js"] }).catch(() => undefined); }
  const handlers = createHandlers({
    client, refresher, runner, now: () => Date.now(),
    captureTab: () => browser.tabs.captureVisibleTab({ format: "png" }),
    primeAnimation: (tabId, itemId) => {
      captureTabs.set(itemId, tabId);
      void ensurePageScript(tabId);
    },
    activeTab: async () => { const [t] = await browser.tabs.query({ active: true, lastFocusedWindow: true }); return { id: t?.id ?? -1, title: t?.title ?? "", url: t?.url ?? "" }; },
    askPage: async (tabId) => { await ensurePageScript(tabId); return (await browser.tabs.sendMessage(tabId, { type: "page-selection" })) as { text: string; title: string; url: string }; },
    fetchImage: (u) => fetch(u, { credentials: "omit" }),
    fetchViaPage: async (tabId, url) => {
      await ensurePageScript(tabId);
      const port = browser.tabs.connect(tabId, { name: "page-image" });
      return new Promise((resolve, reject) => {
        let settled = false;
        const settle = (fn: () => void) => { if (settled) return; settled = true; fn(); };
        const a = new ChunkAssembler();
        port.onDisconnect.addListener(() => settle(() => reject(new Error("no-page"))));
        port.onMessage.addListener(async (m: { index?: number; b64?: string; done?: boolean; sha256?: string; contentType?: string; error?: string }) => {
          if (m.error) { settle(() => reject(m.error === "too-large" ? new TooLargeError(0) : new Error(m.error))); port.disconnect(); return; }
          if (m.b64 !== undefined && m.index !== undefined) { a.push(m.index, m.b64); return; }
          if (m.done) {
            try { const bytes = await a.finish(m.sha256!); settle(() => resolve({ bytes, sha256: m.sha256!, contentType: m.contentType ?? "" })); }
            catch (e) { settle(() => reject(e)); }
            finally { port.disconnect(); }
          }
        });
        port.postMessage({ url });
      });
    },
    notify,
    setBadge,
    startSignIn: () => startSignIn({ client: currentClient() }),
  });
  /** Menus and alarms do not survive every restart, and onInstalled fires only once, so both
   *  are re-armed at every background start. installMenus removes before it creates, and an
   *  alarm is left alone when it already exists so its schedule is not reset on every wake. */
  async function ensureAlarm(name: string, periodInMinutes: number) {
    if (await browser.alarms.get(name)) return;
    await browser.alarms.create(name, { periodInMinutes });
  }
  async function rearm() {
    await installMenus();
    await ensureAlarm("queue-tick", 1);
    await ensureAlarm("sweep", 60);
  }
  browser.runtime.onStartup.addListener(() => { void runner.recoverOnStartup().then(() => runner.tick()); });
  browser.alarms.onAlarm.addListener((a) => { if (a.name === "queue-tick") void runner.tick(); if (a.name === "sweep") void sweepItems(Date.now()); });
  browser.commands.onCommand.addListener((name) => { void report(handlers.onCommand(name).then((r) => r ?? { ok: true })); });
  browser.contextMenus.onClicked.addListener((info, tab) => {
    const t = { id: tab?.id ?? -1, title: tab?.title ?? "", url: tab?.url ?? "" };
    if (info.menuItemId === MENU.image && info.srcUrl) void report(handlers.saveImage(info.srcUrl, t));
    if (info.menuItemId === MENU.selection) void report(handlers.saveSelection(t));
    if (info.menuItemId === MENU.screenshot) void report(handlers.saveScreenshot(t));
  });
  /** The offscreen document reports its outcome as a message as well as through its reply,
   *  so an upload that outlived the worker still lands. Applying it twice is a no-op. */
  async function applyOffscreen(msg: OffscreenMessage): Promise<void> {
    if (msg.type === "upload-progress") return; // the message itself kept the worker awake
    const item = await getItem(msg.itemId);
    const patch = applyOffscreenMessage(item, msg, Date.now());
    if (!patch) return;
    await updateItem(msg.itemId, patch);
    if (patch.state === "done") {
      await deleteBlob(msg.itemId);
      notifySaved(msg.itemId, item!.filename, item!.thumb);
    }
    await setBadge(badgeText(await listItems()));
  }
  browser.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
    if (!msg || typeof msg !== "object" || !("type" in msg)) return;
    if (msg.type === "upload-progress" || msg.type === "upload-done" || msg.type === "upload-failed") {
      void applyOffscreen(msg);
      return;
    }
    handlers.handle(msg).then(sendResponse, (e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  });
  void rearm();
  void runner.recoverOnStartup().then(() => runner.tick());
});
