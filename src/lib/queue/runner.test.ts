// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createRunner, badgeText } from "./runner";
import { putItem, getItem, putBlob, getBlob, listItems } from "../store/items";
import type { SaveItem } from "../messages";
const item = (id: string, over: Partial<SaveItem> = {}): SaveItem => ({ id, filename: "f", state: "queued", kind: "image", sourceUrl: "", sourceTitle: "", workspaceId: "w", folderId: null, sha256: "", bytes: 1, createdAt: Number(id), updatedAt: 0, fileId: null, message: null, attempts: 0, nextAttemptAt: 0, ...over });
describe("runner", () => {
  it("runs two at a time, records done, deletes the blob, keeps the item", async () => {
    for (const id of ["1", "2", "3"]) { await putItem(item(id)); await putBlob(id, new Blob(["x"])); }
    let inFlight = 0, peak = 0;
    const executor = vi.fn(async (i: SaveItem) => { inFlight++; peak = Math.max(peak, inFlight); await new Promise((r) => setTimeout(r, 5)); inFlight--; return { kind: "done" as const, fileId: `f${i.id}` }; });
    const r = createRunner({ executor, now: () => 1000 });
    await r.tick();
    expect(peak).toBe(2); expect(executor).toHaveBeenCalledTimes(2);
    await r.tick();
    expect(executor).toHaveBeenCalledTimes(3);
    expect((await getItem("1"))?.state).toBe("done"); expect(await getBlob("1")).toBeNull(); expect((await getItem("1"))?.fileId).toBe("f1");
  });
  it("a retry result reschedules; a failed result keeps the blob", async () => {
    await putItem(item("1")); await putBlob("1", new Blob(["x"]));
    const r = createRunner({ executor: async () => ({ kind: "retry", afterMs: 3000, message: "Waiting for network" }), now: () => 1000 });
    await r.tick();
    expect((await getItem("1"))).toMatchObject({ state: "queued", attempts: 1, nextAttemptAt: 4000, message: "Waiting for network" });
    const f = createRunner({ executor: async () => ({ kind: "failed", message: "Too big" }), now: () => 5000 });
    await f.tick();
    expect((await getItem("1"))?.state).toBe("failed"); expect(await getBlob("1")).not.toBeNull();
  });
  it("an executor that throws retries with backoff and the message 'Upload interrupted'", async () => {
    await putItem(item("1")); await putBlob("1", new Blob(["x"]));
    const r = createRunner({ executor: async () => { throw new Error("boom"); }, now: () => 1000 });
    await r.tick();
    const updated = await getItem("1");
    expect(updated?.state).toBe("queued");
    expect(updated?.attempts).toBe(1);
    expect(updated?.nextAttemptAt).toBeGreaterThan(1000);
    expect(updated?.message).toBe("Upload interrupted");
  });
  it("recoverOnStartup returns uploading items to queued and the badge counts queued plus waiting", async () => {
    await putItem(item("1", { state: "uploading", updatedAt: -700_000 })); await putItem(item("2", { state: "done" })); await putItem(item("3", { nextAttemptAt: 9999 }));
    const r = createRunner({ executor: async () => ({ kind: "done", fileId: "f" }), now: () => 100 });
    await r.recoverOnStartup();
    expect((await getItem("1"))?.state).toBe("queued");
    expect(badgeText(await listItems())).toBe("2");
    expect(badgeText([item("x", { state: "done" })])).toBe("");
  });
});
