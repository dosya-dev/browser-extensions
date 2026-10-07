// @vitest-environment node
import { describe, it, expect } from "vitest";
import { applyResult, pickRunnable } from "./machine";
import type { SaveItem } from "../messages";
const it_ = (id: string, over: Partial<SaveItem> = {}): SaveItem => ({ id, filename: "f", state: "queued", kind: "image", sourceUrl: "", sourceTitle: "", workspaceId: "w", folderId: null, sha256: "", bytes: 1, createdAt: Number(id), updatedAt: 0, fileId: null, message: null, attempts: 0, nextAttemptAt: 0, ...over });
describe("queue machine", () => {
  it("applyResult maps done, retry and failed", () => {
    expect(applyResult(it_("1"), { kind: "done", fileId: "f" }, 100)).toEqual({ state: "done", fileId: "f", message: null });
    expect(applyResult(it_("1", { attempts: 1 }), { kind: "retry", afterMs: 2000, message: "m" }, 100)).toEqual({ state: "queued", attempts: 2, nextAttemptAt: 2100, message: "m" });
    expect(applyResult(it_("1"), { kind: "failed", message: "x" }, 100)).toEqual({ state: "failed", message: "x" });
  });
  it("pickRunnable: at most two, due, not running, oldest first", () => {
    const items = [it_("3"), it_("1"), it_("2", { nextAttemptAt: 500 }), it_("4", { state: "done" }), it_("5")];
    expect(pickRunnable(items, 100, new Set(["1"])).map((i) => i.id)).toEqual(["3"]); // "1" holds one of the two slots
    expect(pickRunnable(items, 600, new Set()).map((i) => i.id)).toEqual(["1", "2"]);
  });
});
