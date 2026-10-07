// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { createClient } from "./client";
import { listWorkspaces, listFolders, uploadOneShot, createShareLink, exchangeCode } from "./routes";
const c = () => createClient({ get: async () => "t", refresh: async () => "t" }, "https://api.test", { sleep: async () => {} });
const ok = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });

afterEach(() => { vi.unstubAllGlobals(); });

describe("routes", () => {
  it("listWorkspaces drops end-to-end encrypted ones", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok({ ok: true, workspaces: [{ id: "a", name: "A", e2ee_mode: 0 }, { id: "v", name: "Vault", e2ee_mode: 1 }] })));
    expect(await listWorkspaces(c())).toEqual([{ id: "a", name: "A" }]);
  });
  it("listFolders maps parent_id to parentId", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok({ ok: true, folders: [{ id: "f", name: "F", parent_id: null }] })));
    expect(await listFolders(c(), "ws")).toEqual([{ id: "f", name: "F", parentId: null }]);
  });
  it("uploadOneShot sends the blob with both headers and reads the file id; a replay is flagged", async () => {
    const f = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => ok({ ok: true, file: { id: "file_1" } }, 200, { "X-Dosya-Idempotent-Replay": "true" })); vi.stubGlobal("fetch", f);
    const r = await uploadOneShot(c(), { workspaceId: "ws", folderId: "fo", filename: "a b.png", blob: new Blob(["x"]), sha256: "ab".repeat(32), idempotencyKey: "3fa85f64-5717-4562-b3fc-2c963f66afa6" });
    expect(r).toEqual({ fileId: "file_1", replayed: true });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/api/upload/file?workspace_id=ws&folder_id=fo&file_name=a+b.png");
    expect(init.method).toBe("PUT"); expect(init.body).toBeInstanceOf(Blob);
    expect(init.headers).toMatchObject({ "X-Dosya-Sha256": "ab".repeat(32), "X-Dosya-Idempotency-Key": "3fa85f64-5717-4562-b3fc-2c963f66afa6" });
    expect(init.headers).not.toHaveProperty("Content-Length");
  });
  it("createShareLink posts the shared body builder's output and returns the url", async () => {
    const f = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => ok({ ok: true, link: { url: "https://dosya.dev/s/abc" } }, 201)); vi.stubGlobal("fetch", f);
    expect(await createShareLink(c(), "file_1", 1_700_000_000)).toBe("https://dosya.dev/s/abc");
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/api/files/file_1/share");
    expect(JSON.parse(init.body as string)).toEqual({ expires_at: 1_700_000_000 });
  });
  it("exchangeCode posts code, verifier and client without an Authorization header", async () => {
    const f = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => ok({ ok: true, access_token: "a", refresh_token: "r", user: { id: "u", email: "e", name: "n", created_at: 1 } })); vi.stubGlobal("fetch", f);
    expect(await exchangeCode("https://api.test", { code: "dmoc_x", verifier: "v", client: "chrome" })).toEqual({ accessToken: "a", refreshToken: "r", user: { id: "u", email: "e", name: "n" } });
    const init = f.mock.calls[0][1] as RequestInit;
    expect(init.headers).not.toHaveProperty("Authorization");
    expect(JSON.parse(init.body as string)).toEqual({ code: "dmoc_x", code_verifier: "v", client: "chrome" });
  });
});
