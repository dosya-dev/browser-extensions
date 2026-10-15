import type { Message, PopupState, Destination, SaveItem } from "../messages";
import type { Client } from "../api/client";
import { createShareLink, listWorkspaces } from "../api/routes";
import { loadTokens } from "../store/auth-store";
import { getDestination, setDestination, rememberFolder, getPendingPkce, SIGN_IN_PENDING_MS, getAnimations, setAnimations } from "../store/prefs";
import { listItems, putItem, deleteItem, updateItem } from "../store/items";
import { captureImage, captureScreenshot, captureSelection } from "../capture/capture";
import { imageFilename } from "../capture/filename";
import { completeSignIn, signOut as doSignOut } from "../auth/sign-in";
import { badgeText } from "../queue/runner";
import { rememberBlocked } from "../permissions";
export interface BackgroundContext {
  client: Client; refresher: { refresh(): Promise<string | null> };
  runner: { tick(): Promise<void>; recoverOnStartup(): Promise<number>; running: Set<string> };
  now(): number;
  captureTab(): Promise<string>; activeTab(): Promise<{ id: number; title: string; url: string }>;
  askPage(tabId: number): Promise<{ text: string; title: string; url: string }>;
  /**
   * Gets a tab ready to draw the save flight, and remembers it for this item.
   *
   * Called at CAPTURE time on purpose. Reaching into a page needs permission
   * for it, and by default all the extension holds is `activeTab`, which the
   * click or the shortcut grants. Chrome keeps that grant until the tab
   * navigates, so injecting later worked there; Safari lets it lapse almost
   * at once, so the injection at upload-completion time threw and the flight
   * was silently never drawn.
   */
  primeAnimation?(tabId: number, itemId: string): void;
  fetchImage(url: string): Promise<Response>;
  fetchViaPage(tabId: number, url: string): Promise<{ bytes: Uint8Array; sha256: string; contentType: string }>;
  notify(title: string, message: string): Promise<void>; setBadge(text: string): Promise<void>;
  startSignIn(): Promise<{ ok: boolean; error?: string }>;
}
export function createHandlers(ctx: BackgroundContext) {
  async function refreshBadge() { await ctx.setBadge(badgeText(await listItems())); }
  async function destinationOrDefault(): Promise<Destination | null> {
    const d = await getDestination(); if (d) return d;
    const ws = await listWorkspaces(ctx.client).catch(() => []); if (!ws.length) return null;
    const def = { workspaceId: ws[0].id, workspaceName: ws[0].name, folderId: null, folderName: ws[0].name };
    await setDestination(def); return def;
  }
  async function afterCapture(_item: SaveItem) { await refreshBadge(); void ctx.runner.tick(); return { ok: true }; }
  async function signInPending(): Promise<boolean> {
    const pending = await getPendingPkce();
    return !!pending && Date.now() - pending.startedAt < SIGN_IN_PENDING_MS;
  }
  async function requireSignedIn(): Promise<{ ok: false; error: "signed-out" } | null> {
    if (await loadTokens()) return null;
    if (!(await signInPending())) void ctx.startSignIn();
    return { ok: false, error: "signed-out" };
  }
  async function saveScreenshot(tab?: { id: number; title: string; url: string }) {
    const gate = await requireSignedIn(); if (gate) return gate;
    const destination = await destinationOrDefault(); if (!destination) return { ok: false, error: "no-workspace" };
    try {
      const activeTab = tab ?? (await ctx.activeTab());
      const item = await captureScreenshot({ captureTab: ctx.captureTab, activeTab: async () => ({ title: activeTab.title, url: activeTab.url }), destination, now: ctx.now() });
      ctx.primeAnimation?.(activeTab.id, item.id);
      return afterCapture(item);
    } catch { return { ok: false, error: "no-page" }; }
  }
  async function saveSelection(tab?: { id: number; title: string; url: string }, preloaded?: { text: string; title: string; url: string }) {
    const gate = await requireSignedIn(); if (gate) return gate;
    const destination = await destinationOrDefault(); if (!destination) return { ok: false, error: "no-workspace" };
    try {
      const activeTab = tab ?? (await ctx.activeTab());
      const r = await captureSelection({ askPage: () => (preloaded ? Promise.resolve(preloaded) : ctx.askPage(activeTab.id)), destination, now: ctx.now() });
      if ("empty" in r) return { ok: false, error: "no-selection" };
      ctx.primeAnimation?.(activeTab.id, r.id);
      return afterCapture(r);
    } catch { return { ok: false, error: "no-page" }; }
  }
  async function storeBlockedImage(imageUrl: string, tab: { title: string; url: string }, destination: Destination) {
    const now = ctx.now();
    const item: SaveItem = {
      id: crypto.randomUUID(), filename: imageFilename(imageUrl, null, tab.title), state: "failed", kind: "image",
      sourceUrl: tab.url, sourceTitle: tab.title, workspaceId: destination.workspaceId, folderId: destination.folderId,
      folderName: destination.folderName, sha256: "", bytes: 0, createdAt: now, updatedAt: now, fileId: null,
      message: "blocked", attempts: 0, nextAttemptAt: now, imageUrl,
    };
    await putItem(item);
    await rememberBlocked(imageUrl);
    await refreshBadge();
  }
  async function saveImage(imageUrl: string, tab: { id: number; title: string; url: string }) {
    const gate = await requireSignedIn(); if (gate) return gate;
    const destination = await destinationOrDefault(); if (!destination) return { ok: false, error: "no-workspace" };
    const r = await captureImage({ imageUrl, pageTitle: tab.title, pageUrl: tab.url, destination, now: ctx.now(),
      fetchBackground: (u) => ctx.fetchImage(u), fetchViaPage: (u) => ctx.fetchViaPage(tab.id, u) });
    if ("error" in r) {
      if (r.error === "blocked") await storeBlockedImage(imageUrl, tab, destination);
      return { ok: false, error: r.error };
    }
    ctx.primeAnimation?.(tab.id, r.id);
    return afterCapture(r);
  }
  async function retryBlockedImage(item: SaveItem) {
    const gate = await requireSignedIn(); if (gate) return gate;
    const destination: Destination = { workspaceId: item.workspaceId, workspaceName: "", folderId: item.folderId, folderName: item.folderName ?? "" };
    const r = await captureImage({ imageUrl: item.imageUrl!, pageTitle: item.sourceTitle, pageUrl: item.sourceUrl, destination, now: ctx.now(),
      fetchBackground: (u) => ctx.fetchImage(u), fetchViaPage: () => Promise.reject(new Error("no-page")) });
    if ("error" in r) {
      await updateItem(item.id, { message: r.error });
      return { ok: false, error: r.error };
    }
    await deleteItem(item.id);
    return afterCapture(r);
  }
  async function handle(msg: Message): Promise<unknown> {
    switch (msg.type) {
      case "get-state": {
        const t = await loadTokens(); const items = await listItems();
        const state: PopupState = { signedIn: !!t, user: t?.user ?? null, destination: t ? await destinationOrDefault() : null, animations: await getAnimations(), recent: items.slice(0, 10),
          queued: items.filter((i) => i.state === "queued" && i.nextAttemptAt <= ctx.now()).length + items.filter((i) => i.state === "uploading").length,
          waiting: items.filter((i) => i.state === "queued" && i.nextAttemptAt > ctx.now()).length };
        return state;
      }
      case "sign-in": return (await signInPending()) ? { ok: true } : ctx.startSignIn();
      case "sign-out": await doSignOut(ctx.client); return { ok: true };
      case "save-screenshot": return saveScreenshot();
      case "save-selection": return saveSelection();
      case "set-destination": await setDestination(msg.destination); await rememberFolder(msg.destination); return { ok: true };
      case "set-animations": await setAnimations(msg.on); return { ok: true };
      case "retry": {
        const item = (await listItems()).find((i) => i.id === msg.itemId);
        if (item && item.message === "blocked" && item.kind === "image" && item.imageUrl) {
          return retryBlockedImage(item);
        }
        await updateItem(msg.itemId, { state: "queued", nextAttemptAt: ctx.now(), message: null }); await refreshBadge(); void ctx.runner.tick(); return { ok: true };
      }
      case "copy-link": {
        const item = (await listItems()).find((i) => i.id === msg.itemId);
        if (!item?.fileId) return { ok: false };
        const expiresAt = msg.expiresDays ? Math.floor(ctx.now() / 1000) + msg.expiresDays * 86400 : null;
        return { url: await createShareLink(ctx.client, item.fileId, expiresAt) };
      }
      case "get-token": return { accessToken: (await loadTokens())?.accessToken ?? null };
      case "token-expired": return { accessToken: await ctx.refresher.refresh() };
      case "extension-callback": return completeSignIn({ code: msg.code, state: msg.state });
      default: return { ok: false };
    }
  }
  return { handle, saveImage, saveScreenshot, saveSelection, refreshBadge,
    async onCommand(name: string) {
      if (name !== "save-default") return;
      const tab = await ctx.activeTab();
      const sel = await ctx.askPage(tab.id).catch(() => ({ text: "", title: tab.title, url: tab.url }));
      return sel.text.trim() ? saveSelection(tab, sel) : saveScreenshot(tab);
    },
  };
}
