// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { runUpload } from "./one-shot";
import { ApiError, type Client } from "../api/client";
import type { SaveItem } from "../messages";
const item = (attempts = 0): SaveItem => ({ id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", filename: "a.png", state: "uploading", kind: "image", sourceUrl: "u", sourceTitle: "t", workspaceId: "ws", folderId: "fo", sha256: "ab".repeat(32), bytes: 1, createdAt: 0, updatedAt: 0, fileId: null, message: null, attempts, nextAttemptAt: 0 });
const client = (impl: () => Promise<Response>) => ({ fetch: vi.fn(impl), json: vi.fn() }) as unknown as Client;
describe("runUpload", () => {
  it("done: posts the blob with the item id as the idempotency key", async () => {
    const c = client(async () => new Response(JSON.stringify({ file: { id: "f1" } }), { status: 201 }));
    const r = await runUpload(item(), { client: c, getBlob: async () => new Blob(["x"]) });
    expect(r).toEqual({ kind: "done", fileId: "f1" });
    const init = (c.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ "X-Dosya-Idempotency-Key": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "X-Dosya-Sha256": "ab".repeat(32) });
  });
  it("429 and 409 retry after the server's delay; 503 backs off exponentially up to 5 minutes", async () => {
    expect(await runUpload(item(), { client: client(async () => { throw new ApiError(429, "{}", 17); }), getBlob: async () => new Blob(["x"]) })).toEqual({ kind: "retry", afterMs: 17000, message: "Rate limited" });
    expect(await runUpload(item(), { client: client(async () => { throw new ApiError(409, "{}", null); }), getBlob: async () => new Blob(["x"]) })).toMatchObject({ kind: "retry", afterMs: 5000 });
    expect(await runUpload(item(3), { client: client(async () => { throw new ApiError(503, "{}"); }), getBlob: async () => new Blob(["x"]) })).toMatchObject({ kind: "retry", afterMs: 16000 });
    expect(await runUpload(item(20), { client: client(async () => { throw new ApiError(0, "net"); }), getBlob: async () => new Blob(["x"]) })).toMatchObject({ kind: "retry", afterMs: 300000 });
  });
  it("413 and 422 fail with the server message; 401 fails as signed out; a missing blob fails", async () => {
    expect(await runUpload(item(), { client: client(async () => { throw new ApiError(413, JSON.stringify({ error: "File is larger than your plan allows" })); }), getBlob: async () => new Blob(["x"]) })).toEqual({ kind: "failed", message: "File is larger than your plan allows" });
    expect(await runUpload(item(), { client: client(async () => { throw new ApiError(401, "{}"); }), getBlob: async () => new Blob(["x"]) })).toEqual({ kind: "failed", message: "Signed out" });
    expect(await runUpload(item(), { client: client(async () => new Response("{}")), getBlob: async () => null })).toEqual({ kind: "failed", message: "Capture is gone" });
  });
});
