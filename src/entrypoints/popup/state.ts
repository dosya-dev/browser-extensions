import { useEffect, useState, useCallback } from "react";
import { browser } from "wxt/browser";
import { send, type PopupState } from "../../lib/messages";
import { createClient } from "../../lib/api/client";
import { listWorkspaces, listFolders, createFolder as createFolderRoute, type Workspace, type Folder } from "../../lib/api/routes";

export const popupClient = createClient({
  get: async () => (await send({ type: "get-token" })).accessToken,
  refresh: async () => (await send({ type: "token-expired" })).accessToken,
});

export function usePopupState() {
  const [state, setState] = useState<PopupState | null>(null);
  const reload = useCallback(async () => { setState(await send({ type: "get-state" })); }, []);
  useEffect(() => { void reload(); const t = setInterval(() => { void reload(); }, 2000); return () => clearInterval(t); }, [reload]);
  return { state, reload };
}

const FOLDERS_TTL_MS = 60 * 60_000;

export interface UseFolders {
  workspaces: Workspace[];
  folders: Folder[];
  loading: boolean;
  createFolder(workspaceId: string, parentId: string | null, name: string): Promise<Folder>;
}

/** The popup's folder picker: one workspace list plus a cached, per-workspace folder tree. */
export function useFolders(workspaceId: string | null): UseFolders {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { void listWorkspaces(popupClient).then(setWorkspaces); }, []);

  const loadFolders = useCallback(async (id: string) => {
    const key = `folders:${id}`;
    setLoading(true);
    try {
      const stored = (await browser.storage.local.get(key)) as Record<string, { folders: Folder[]; cachedAt: number } | undefined>;
      const cached = stored[key];
      if (cached && Date.now() - cached.cachedAt < FOLDERS_TTL_MS) { setFolders(cached.folders); return; }
      const list = await listFolders(popupClient, id);
      await browser.storage.local.set({ [key]: { folders: list, cachedAt: Date.now() } });
      setFolders(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!workspaceId) { setFolders([]); return; }
    void loadFolders(workspaceId);
  }, [workspaceId, loadFolders]);

  const create = useCallback(async (wsId: string, parentId: string | null, name: string) => {
    const folder = await createFolderRoute(popupClient, wsId, parentId, name);
    await browser.storage.local.remove(`folders:${wsId}`);
    if (wsId === workspaceId) await loadFolders(wsId);
    return folder;
  }, [workspaceId, loadFolders]);

  return { workspaces, folders, loading, createFolder: create };
}
