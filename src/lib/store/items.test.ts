// @vitest-environment node
import { describe, it, expect } from "vitest";
import { putItem, getItem, listItems, updateItem, putBlob, getBlob, deleteBlob, sweepItems, requeueUploading, listByState, UPLOAD_STALE_MS } from "./items";
import type { SaveItem } from "../messages";

const DAY = 86_400_000;
function item(id: string, over: Partial<SaveItem> = {}): SaveItem {
  return { id, filename: `${id}.png`, state: "queued", kind: "image", sourceUrl: "https://x/a", sourceTitle: "A",
    workspaceId: "ws", folderId: null, sha256: "0".repeat(64), bytes: 10, createdAt: 1_000, updatedAt: 1_000,
    fileId: null, message: null, attempts: 0, nextAttemptAt: 0, ...over };
}

describe("items store", () => {
  it("round-trips an item and lists newest first", async () => {
    await putItem(item("a", { createdAt: 1 })); await putItem(item("b", { createdAt: 2 }));
    expect((await getItem("a"))?.filename).toBe("a.png");
    expect((await listItems()).map((i) => i.id)).toEqual(["b", "a"]);
  });
  it("updateItem merges a patch and bumps updatedAt", async () => {
    await putItem(item("a"));
    await updateItem("a", { state: "done", fileId: "f1" });
    const a = await getItem("a");
    expect(a?.state).toBe("done"); expect(a?.fileId).toBe("f1"); expect(a?.updatedAt).toBeGreaterThan(1_000);
  });
  it("stores and deletes blobs separately from items", async () => {
    await putItem(item("a")); await putBlob("a", new Blob(["hi"]));
    expect(await (await getBlob("a"))?.text()).toBe("hi");
    await deleteBlob("a");
    expect(await getBlob("a")).toBeNull();
    expect(await getItem("a")).not.toBeNull();
  });
  it("requeueUploading returns stale uploading items to queued but leaves a fresh one alone", async () => {
    await putItem(item("a", { state: "uploading", updatedAt: 1_000 })); await putItem(item("b", { state: "done" }));
    await putItem(item("c", { state: "uploading", updatedAt: 500_000 }));
    const now = 1_000_000;
    await requeueUploading(now);
    expect((await getItem("a"))?.state).toBe("queued"); expect((await getItem("a"))?.nextAttemptAt).toBe(now);
    expect((await getItem("b"))?.state).toBe("done");
    expect((await getItem("c"))?.state).toBe("uploading");
    expect((await listByState("queued")).length).toBe(1);
  });
  it("UPLOAD_STALE_MS is the threshold used above", () => { expect(UPLOAD_STALE_MS).toBe(10 * 60_000); });
  it("sweep: items older than 30 days go, failed blobs older than 7 days go, the rest stay", async () => {
    const now = 100 * DAY;
    await putItem(item("old", { state: "done", createdAt: now - 31 * DAY }));
    await putItem(item("failed", { state: "failed", createdAt: now - 8 * DAY, updatedAt: now - 8 * DAY })); await putBlob("failed", new Blob(["x"]));
    await putItem(item("fresh", { state: "failed", createdAt: now - DAY, updatedAt: now - DAY })); await putBlob("fresh", new Blob(["y"]));
    const r = await sweepItems(now);
    expect(r).toEqual({ itemsDeleted: 1, blobsDeleted: 1, itemsFailed: 0, itemsRequeued: 0 });
    expect(await getItem("old")).toBeNull();
    expect(await getBlob("failed")).toBeNull(); expect(await getItem("failed")).not.toBeNull();
    expect(await getBlob("fresh")).not.toBeNull();
  });
  it("sweep also reclaims a blob whose item is gone", async () => {
    await putBlob("orphan", new Blob(["z"]));
    const r = await sweepItems(100 * DAY);
    expect(r.blobsDeleted).toBe(1);
    expect(await getBlob("orphan")).toBeNull();
  });
  it("sweep: a fresh capture survives; a stale one is requeued if it has its blob and fails if it does not", async () => {
    const now = 100 * DAY;
    await putItem(item("captured-fresh", { state: "captured", createdAt: now - 60_000 })); await putBlob("captured-fresh", new Blob(["c"]));
    await putItem(item("captured-orphaned", { state: "captured", createdAt: now - DAY })); await putBlob("captured-orphaned", new Blob(["d"]));
    await putItem(item("captured-stale", { state: "captured", createdAt: now - 11 * 60_000 }));
    const r = await sweepItems(now);
    expect(r.itemsFailed).toBe(1); expect(r.itemsRequeued).toBe(1);
    expect(await getBlob("captured-fresh")).not.toBeNull();
    expect((await getItem("captured-fresh"))?.state).toBe("captured");
    expect((await getItem("captured-orphaned"))?.state).toBe("queued");
    expect((await getItem("captured-orphaned"))?.nextAttemptAt).toBe(now);
    expect(await getBlob("captured-orphaned")).not.toBeNull();
    expect((await getItem("captured-stale"))?.state).toBe("failed");
    expect((await getItem("captured-stale"))?.message).toBe("Capture is gone");
  });
});
