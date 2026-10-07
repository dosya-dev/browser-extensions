import { browser } from "wxt/browser";
import { withStore, request } from "./db";
import type { AuthUser } from "../messages";
export interface StoredTokens { accessToken: string; refreshToken: string; user: AuthUser }
let accessLevelSet = false;
async function sessionArea() {
  const area = browser.storage.session;
  if (!accessLevelSet && typeof (area as { setAccessLevel?: unknown }).setAccessLevel === "function") {
    try { await (area as unknown as { setAccessLevel(o: { accessLevel: string }): Promise<void> }).setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }); } catch { /* Firefox: default is already trusted-only */ }
    accessLevelSet = true;
  }
  return area;
}
export async function saveTokens(t: StoredTokens): Promise<void> {
  await withStore("auth", "readwrite", (s) => request(s.put({ key: "tokens", ...t })).then(() => undefined));
  await (await sessionArea()).set({ accessToken: t.accessToken });
}
export async function loadTokens(): Promise<StoredTokens | null> {
  const row = await withStore("auth", "readonly", (s) => request(s.get("tokens")).then((v) => v as (StoredTokens & { key: string }) | undefined));
  if (!row) return null;
  const { key: _k, ...t } = row; return t;
}
export async function clearTokens(): Promise<void> {
  await withStore("auth", "readwrite", (s) => request(s.delete("tokens")).then(() => undefined));
  await (await sessionArea()).remove("accessToken");
}
