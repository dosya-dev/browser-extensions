// @vitest-environment node
import { describe, it, expect } from "vitest";
import { applyOffscreenMessage } from "./offscreen-results";
import type { SaveItem } from "../messages";
const row = (over: Partial<SaveItem> = {}): SaveItem => ({ id: "1", filename: "f", state: "uploading", kind: "image", sourceUrl: "", sourceTitle: "", workspaceId: "w", folderId: null, sha256: "", bytes: 1, createdAt: 1, updatedAt: 0, fileId: null, message: null, attempts: 0, nextAttemptAt: 0, ...over });

describe("applyOffscreenMessage", () => {
  it("marks an uploading row done", () => {
    expect(applyOffscreenMessage(row(), { type: "upload-done", itemId: "1", fileId: "fid" }, 100))
      .toEqual({ state: "done", fileId: "fid", message: null });
  });
  it("ignores a done message for a row that is already done", () => {
    expect(applyOffscreenMessage(row({ state: "done", fileId: "fid" }), { type: "upload-done", itemId: "1", fileId: "fid" }, 100)).toBeNull();
  });
  it("requeues on a retryable failure, counting the attempt", () => {
    expect(applyOffscreenMessage(row({ attempts: 1 }), { type: "upload-failed", itemId: "1", status: 0, message: "Rate limited", retryAfterS: 30 }, 100))
      .toEqual({ state: "queued", attempts: 2, nextAttemptAt: 30_100, message: "Rate limited" });
  });
  it("fails terminally on a non-retryable failure", () => {
    expect(applyOffscreenMessage(row(), { type: "upload-failed", itemId: "1", status: -1, message: "Upload refused (415)", retryAfterS: null }, 100))
      .toEqual({ state: "failed", message: "Upload refused (415)" });
  });
  it("ignores a failure for a row that is no longer uploading", () => {
    expect(applyOffscreenMessage(row({ state: "queued" }), { type: "upload-failed", itemId: "1", status: -1, message: "x", retryAfterS: null }, 100)).toBeNull();
  });
  it("ignores a heartbeat and a message for an unknown item", () => {
    expect(applyOffscreenMessage(row(), { type: "upload-progress", itemId: "1", bytes: 0 }, 100)).toBeNull();
    expect(applyOffscreenMessage(null, { type: "upload-done", itemId: "gone", fileId: "fid" }, 100)).toBeNull();
  });
});
