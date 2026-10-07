import { API_BASE } from "../config";
import { loadTokens, saveTokens, clearTokens } from "../store/auth-store";
export function createRefresher(base = API_BASE) {
  let inflight: Promise<string | null> | null = null;
  async function run(): Promise<string | null> {
    const cur = await loadTokens();
    if (!cur) return null;
    let res: Response;
    try {
      res = await fetch(`${base}/api/auth/mobile/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: cur.refreshToken }) });
    } catch { return cur.accessToken; }
    if (res.status === 401) { await clearTokens(); return null; }
    if (!res.ok) return cur.accessToken;
    const body = (await res.json()) as { access_token: string; refresh_token: string };
    await saveTokens({ accessToken: body.access_token, refreshToken: body.refresh_token, user: cur.user });
    return body.access_token;
  }
  return { refresh(): Promise<string | null> { if (!inflight) inflight = run().finally(() => { inflight = null; }); return inflight; } };
}
