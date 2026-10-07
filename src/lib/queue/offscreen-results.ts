import type { Message, SaveItem } from "../messages";
import type { UploadResult } from "../upload/one-shot";
import { applyResult } from "./machine";

export type OffscreenMessage = Extract<Message, { type: "upload-progress" | "upload-done" | "upload-failed" }>;

/** The offscreen document reports its result twice: once through `sendResponse` and once as a
 *  message, so a worker that was killed mid-upload still learns the outcome when it wakes.
 *  Both paths land here, so this returns null whenever the row has already moved on. */
export function applyOffscreenMessage(item: SaveItem | null, msg: OffscreenMessage, now: number): Partial<SaveItem> | null {
  if (!item) return null;
  if (msg.type === "upload-progress") return null;
  if (msg.type === "upload-done") {
    if (item.state === "done") return null;
    return applyResult(item, { kind: "done", fileId: msg.fileId }, now);
  }
  if (item.state !== "uploading") return null;
  const outcome: UploadResult = msg.status === 0
    ? { kind: "retry", afterMs: (msg.retryAfterS ?? 0) * 1000, message: msg.message }
    : { kind: "failed", message: msg.message };
  return applyResult(item, outcome, now);
}
