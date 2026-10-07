import { browser } from "wxt/browser";
import { withStore, request } from "./db";
import type { Destination } from "../messages";
const get = <T>(key: string) => withStore("prefs", "readonly", (s) => request(s.get(key)).then((v) => ((v as { value: T } | undefined)?.value ?? null)));
const set = <T>(key: string, value: T) => withStore("prefs", "readwrite", (s) => request(s.put({ key, value })).then(() => undefined));
export const getDestination = () => get<Destination>("destination");
export const setDestination = (d: Destination) => set("destination", d);
export const getRecentFolders = async () => (await get<Destination[]>("recentFolders")) ?? [];
export async function rememberFolder(d: Destination): Promise<void> {
  const cur = (await getRecentFolders()).filter((x) => x.folderId !== d.folderId || x.workspaceId !== d.workspaceId);
  await set("recentFolders", [d, ...cur].slice(0, 5));
}
/** Drops the destination and the recent folders, for sign-out. */
export const clearAll = () => withStore("prefs", "readwrite", (s) => request(s.clear()).then(() => undefined));
export const SIGN_IN_PENDING_MS = 5 * 60_000;
export interface PendingPkce { verifier: string; state: string; client: string; startedAt: number }
export async function setPendingPkce(p: PendingPkce | null): Promise<void> {
  if (p) await browser.storage.session.set({ pendingPkce: p }); else await browser.storage.session.remove("pendingPkce");
}
export async function getPendingPkce(): Promise<PendingPkce | null> {
  return ((await browser.storage.session.get("pendingPkce")).pendingPkce as PendingPkce | undefined) ?? null;
}
