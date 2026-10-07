import { API_BASE } from "../config";
export interface TokenProvider { get(): Promise<string | null>; refresh(): Promise<string | null> }
export class ApiError extends Error {
  constructor(public status: number, public body: string, public retryAfterS: number | null = null) { super(`API ${status}`); }
}
const RETRY_WAITS_MS = [1000, 2000, 4000];
export function createClient(provider: TokenProvider, base = API_BASE, deps: { sleep?: (ms: number) => Promise<void> } = {}) {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  async function once(path: string, init: RequestInit, token: string | null): Promise<Response> {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${base}${path}`, { ...init, headers });
  }
  async function doFetch(path: string, init: RequestInit = {}): Promise<Response> {
    let token = await provider.get();
    let refreshed = false;
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try { res = await once(path, init, token); }
      catch (err) { if (attempt < RETRY_WAITS_MS.length) { await sleep(RETRY_WAITS_MS[attempt]!); continue; } throw new ApiError(0, String(err)); }
      if (res.status === 401 && !refreshed) { refreshed = true; token = await provider.refresh(); if (token) continue; }
      if (res.status === 503 && attempt < RETRY_WAITS_MS.length) { await sleep(RETRY_WAITS_MS[attempt]!); continue; }
      if (res.ok) return res;
      const ra = res.headers.get("Retry-After");
      throw new ApiError(res.status, await res.text(), ra ? Number(ra) : null);
    }
  }
  return {
    fetch: doFetch,
    async json<T>(path: string, init: RequestInit = {}): Promise<T> {
      const res = await doFetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init.headers as Record<string, string> | undefined) } });
      return (await res.json()) as T;
    },
  };
}
export type Client = ReturnType<typeof createClient>;
