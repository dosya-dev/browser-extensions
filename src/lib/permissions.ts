import { browser } from "wxt/browser";

export function originPattern(url: string): string {
  const u = new URL(url);
  return `${u.protocol}//${u.host}/*`;
}

/** Only an http(s) image can be re-fetched under a granted origin, so a data:, blob: or
 *  extension: image is never offered as something the user could allow. */
export function isRequestableOrigin(url: string): boolean {
  try { const p = new URL(url).protocol; return p === "https:" || p === "http:"; } catch { return false; }
}

export async function rememberBlocked(url: string): Promise<void> {
  if (!isRequestableOrigin(url)) return;
  const cur = ((await browser.storage.local.get("blockedOrigins")).blockedOrigins as string[] | undefined) ?? [];
  const p = originPattern(url);
  if (!cur.includes(p)) await browser.storage.local.set({ blockedOrigins: [...cur, p] });
}

export async function peekBlocked(): Promise<string[]> {
  return ((await browser.storage.local.get("blockedOrigins")).blockedOrigins as string[] | undefined) ?? [];
}

export async function takeBlocked(seen: string[]): Promise<string[]> {
  const cur = ((await browser.storage.local.get("blockedOrigins")).blockedOrigins as string[] | undefined) ?? [];
  const taken = cur.filter((p) => seen.includes(p));
  const remaining = cur.filter((p) => !seen.includes(p));
  if (remaining.length) await browser.storage.local.set({ blockedOrigins: remaining });
  else await browser.storage.local.remove("blockedOrigins");
  return taken;
}

export async function requestOrigins(patterns: string[]): Promise<boolean> {
  if (!patterns.length) return true;
  return browser.permissions.request({ origins: patterns });
}
