import { browser } from "wxt/browser";
import { APP_BASE, API_BASE, type Client as ClientName } from "../config";
import { createPkce } from "../pkce";
import { exchangeCode, logout } from "../api/routes";
import type { Client } from "../api/client";
import { saveTokens, clearTokens, loadTokens } from "../store/auth-store";
import { getPendingPkce, setPendingPkce, clearAll as clearPrefs } from "../store/prefs";
import { clearAll as clearItems } from "../store/items";

export function buildConsentUrl(p: { client: string; challenge: string; state: string; redirectUri: string }): string {
  const u = new URL(`${APP_BASE}/connect/extension`);
  u.searchParams.set("client", p.client); u.searchParams.set("code_challenge", p.challenge);
  u.searchParams.set("state", p.state); u.searchParams.set("redirect_uri", p.redirectUri);
  return u.toString();
}
export function identityRedirectUri(): string | null {
  const id = (browser as { identity?: { getRedirectURL?: (p: string) => string; launchWebAuthFlow?: unknown } }).identity;
  return id?.launchWebAuthFlow && id.getRedirectURL ? id.getRedirectURL("callback") : null;
}
export const DONE_REDIRECT = `${APP_BASE}/connect/extension/done`;
async function defaultLaunch(url: string): Promise<string | null> {
  const id = browser.identity as { launchWebAuthFlow(d: { url: string; interactive: boolean }): Promise<string | undefined> };
  try { return (await id.launchWebAuthFlow({ url, interactive: true })) ?? null; } catch { return null; }
}
async function openInTab(url: string): Promise<string | null> {
  await browser.tabs.create({ url }); return null; // the done page's content script finishes the flow
}
export async function completeSignIn(cb: { code: string; state: string }, base = API_BASE): Promise<{ ok: true } | { ok: false; error: string }> {
  const pending = await getPendingPkce();
  if (!pending || pending.state !== cb.state) return { ok: false, error: "Sign-in did not match the request that started it" };
  try {
    const t = await exchangeCode(base, { code: cb.code, verifier: pending.verifier, client: pending.client });
    await saveTokens(t); await setPendingPkce(null);
    return { ok: true };
  } catch (e) { await setPendingPkce(null); return { ok: false, error: e instanceof Error ? e.message : "Sign-in failed" }; }
}
export async function startSignIn(deps: { client: ClientName; launch?: (url: string) => Promise<string | null>; redirectUri?: string; base?: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const pkce = await createPkce();
  await setPendingPkce({ verifier: pkce.verifier, state: pkce.state, client: deps.client, startedAt: Date.now() });
  const redirectUri = deps.redirectUri ?? identityRedirectUri() ?? DONE_REDIRECT;
  const launch = deps.launch ?? (identityRedirectUri() ? defaultLaunch : openInTab);
  const url = buildConsentUrl({ client: deps.client, challenge: pkce.challenge, state: pkce.state, redirectUri });
  const callback = await launch(url);
  if (callback === null) {
    if (redirectUri === DONE_REDIRECT && !deps.launch) return { ok: true }; // the tab flow completes later via extension-callback
    await setPendingPkce(null); return { ok: false, error: "Sign-in was cancelled" };
  }
  const q = new URL(callback).searchParams;
  return completeSignIn({ code: q.get("code") ?? "", state: q.get("state") ?? "" }, deps.base);
}
/** Signing out leaves nothing of the account behind: no tokens, no destination or recent
 *  folders, no cached folder trees, no blocked-origin list, no pending sign-in, no captures. */
export async function signOut(c: Client): Promise<void> {
  const t = await loadTokens();
  if (t) await logout(c, t.refreshToken);
  await clearTokens();
  await setPendingPkce(null);
  await clearPrefs();
  await clearItems();
  const all = await browser.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith("folders:") || k === "blockedOrigins");
  if (keys.length) await browser.storage.local.remove(keys);
}
