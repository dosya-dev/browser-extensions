import { shareEndpoint, buildShareLinkBody } from "@dosya-dev/shared/share/payload";
import type { Client } from "./client";
import type { AuthUser } from "../messages";
export interface Workspace { id: string; name: string }
export interface Folder { id: string; name: string; parentId: string | null }
export async function listWorkspaces(c: Client): Promise<Workspace[]> {
  const r = await c.json<{ workspaces: Array<{ id: string; name: string; e2ee_mode: number }> }>("/api/workspaces");
  return r.workspaces.filter((w) => w.e2ee_mode === 0).map(({ id, name }) => ({ id, name }));
}
export async function listFolders(c: Client, workspaceId: string): Promise<Folder[]> {
  const r = await c.json<{ folders: Array<{ id: string; name: string; parent_id: string | null }> }>(`/api/folders/tree?workspace_id=${encodeURIComponent(workspaceId)}`);
  return r.folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parent_id }));
}
export async function createFolder(c: Client, workspaceId: string, parentId: string | null, name: string): Promise<Folder> {
  const r = await c.json<{ folder: { id: string; name: string; parent_id: string | null } }>("/api/folders", { method: "POST", body: JSON.stringify({ workspace_id: workspaceId, parent_id: parentId, name }) });
  return { id: r.folder.id, name: r.folder.name, parentId: r.folder.parent_id };
}
export interface UploadArgs { workspaceId: string; folderId: string | null; filename: string; blob: Blob; sha256: string; idempotencyKey: string; signal?: AbortSignal }
export async function uploadOneShot(c: Client, a: UploadArgs): Promise<{ fileId: string; replayed: boolean }> {
  const q = new URLSearchParams({ workspace_id: a.workspaceId });
  if (a.folderId) q.set("folder_id", a.folderId);
  q.set("file_name", a.filename);
  const res = await c.fetch(`/api/upload/file?${q.toString()}`, { method: "PUT", body: a.blob, signal: a.signal, headers: { "X-Dosya-Sha256": a.sha256, "X-Dosya-Idempotency-Key": a.idempotencyKey } });
  const body = (await res.json()) as { file: { id: string } };
  return { fileId: body.file.id, replayed: res.headers.get("X-Dosya-Idempotent-Replay") === "true" };
}
export async function createShareLink(c: Client, fileId: string, expiresAt: number | null): Promise<string> {
  const target = { kind: "file" as const, fileIds: [fileId] as const };
  const r = await c.json<{ link: { url: string } }>(shareEndpoint(target, "link"), { method: "POST", body: JSON.stringify(buildShareLinkBody({ target, expiresAt })) });
  return r.link.url;
}
export async function exchangeCode(base: string, a: { code: string; verifier: string; client: string }): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
  const res = await fetch(`${base}/api/auth/extension/exchange`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: a.code, code_verifier: a.verifier, client: a.client }) });
  if (!res.ok) throw new Error(`exchange failed (${res.status})`);
  const b = (await res.json()) as { access_token: string; refresh_token: string; user: { id: string; email: string; name: string } };
  return { accessToken: b.access_token, refreshToken: b.refresh_token, user: { id: b.user.id, email: b.user.email, name: b.user.name } };
}
export async function logout(c: Client, refreshToken: string): Promise<void> {
  await c.fetch("/api/auth/mobile/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refreshToken }) }).catch(() => undefined);
}
