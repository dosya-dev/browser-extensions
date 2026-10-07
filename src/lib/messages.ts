import { browser } from "wxt/browser";
export interface SaveItem {
  id: string; filename: string; state: "captured" | "queued" | "uploading" | "done" | "failed";
  kind: "image" | "selection" | "screenshot"; sourceUrl: string; sourceTitle: string;
  workspaceId: string; folderId: string | null; folderName?: string; sha256: string; bytes: number;
  createdAt: number; updatedAt: number; fileId: string | null; message: string | null; attempts: number; nextAttemptAt: number;
  imageUrl?: string;
  /** Small JPEG preview as a data URL; absent for text and for images the platform could not decode. */
  thumb?: string;
}
export interface AuthUser { id: string; email: string; name: string }
export interface Destination { workspaceId: string; workspaceName: string; folderId: string | null; folderName: string }
export interface PopupState {
  signedIn: boolean; user: AuthUser | null; destination: Destination | null;
  recent: SaveItem[]; queued: number; waiting: number;
}
export type Message =
  | { type: "get-state" }
  | { type: "sign-in" }
  | { type: "sign-out" }
  | { type: "save-screenshot" }
  | { type: "save-selection" }
  | { type: "set-destination"; destination: Destination }
  | { type: "retry"; itemId: string }
  | { type: "copy-link"; itemId: string; expiresDays: 7 | 30 | null }
  | { type: "get-token" }
  | { type: "token-expired" }
  | { type: "upload-progress"; itemId: string; bytes: number }
  | { type: "upload-done"; itemId: string; fileId: string }
  | { type: "upload-failed"; itemId: string; status: number; message: string; retryAfterS: number | null }
  | { type: "extension-callback"; code: string; state: string };
export type ReplyFor<T extends Message> =
  T extends { type: "get-state" } ? PopupState :
  T extends { type: "get-token" } ? { accessToken: string | null } :
  T extends { type: "token-expired" } ? { accessToken: string | null } :
  T extends { type: "copy-link" } ? { url: string } | { ok: false } :
  T extends { type: "sign-in" } ? { ok: boolean; error?: string } :
  { ok: boolean };
export function send<T extends Message>(m: T): Promise<ReplyFor<T>> {
  return browser.runtime.sendMessage(m) as Promise<ReplyFor<T>>;
}
