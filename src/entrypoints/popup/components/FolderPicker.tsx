import { useEffect, useMemo, useState } from "react";
import { Folder as FolderIcon, Search, Plus } from "lucide-react";
import type { Destination } from "../../../lib/messages";
import { getRecentFolders } from "../../../lib/store/prefs";
import { useFolders } from "../state";

export default function FolderPicker({ destination, onChoose, onClose }: { destination: Destination; onChoose: (d: Destination) => void; onClose: () => void }) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(destination.workspaceId);
  const [search, setSearch] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [recent, setRecent] = useState<Destination[]>([]);
  const { workspaces, folders, createFolder } = useFolders(selectedWorkspaceId);

  useEffect(() => { void getRecentFolders().then(setRecent); }, []);

  const workspaceName = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId)?.name ?? "",
    [workspaces, selectedWorkspaceId],
  );

  const filtered = useMemo(
    () => folders.filter((f) => f.name.toLowerCase().includes(search.trim().toLowerCase())),
    [folders, search],
  );

  const resolvedRecent = recent.map((r) => {
    if (r.workspaceId === selectedWorkspaceId) {
      const match = folders.find((f) => f.id === r.folderId);
      if (match) return { ...r, folderName: match.name };
    }
    return r;
  });

  async function handleCreate() {
    const name = newFolderName.trim();
    if (!name) return;
    const parentId = selectedWorkspaceId === destination.workspaceId ? destination.folderId : null;
    const folder = await createFolder(selectedWorkspaceId, parentId, name);
    setNewFolderName("");
    onChoose({ workspaceId: selectedWorkspaceId, workspaceName, folderId: folder.id, folderName: folder.name });
  }

  return (
    <div className="absolute inset-0 z-20">
      <div className="absolute inset-0 bg-[#18181b]/45" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Choose a folder"
        className="absolute left-0 right-0 bottom-0 bg-white border-t border-[#e4e4e4] rounded-t-2xl px-4 pt-[18px] pb-4 flex flex-col gap-3 max-h-[80%] shadow-[0_-12px_32px_rgba(24,24,27,0.18)]"
      >
        <h2 className="m-0 text-[15px] font-semibold">Choose a folder</h2>

        {workspaces.length > 1 && (
          <select
            value={selectedWorkspaceId}
            onChange={(e) => setSelectedWorkspaceId(e.target.value)}
            className="h-9 border border-[#e4e4e4] rounded-[10px] bg-white px-2.5"
          >
            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}

        <div className="flex items-center gap-2 h-9 px-2.5 border border-[#e4e4e4] rounded-[10px] bg-[#fafafa]">
          <Search size={14} className="text-[#6b6b6b]" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search folders"
            className="flex-grow bg-transparent border-none outline-none text-sm"
          />
        </div>

        <div className="flex-grow overflow-auto flex flex-col gap-0.5">
          {search.trim() === "" && resolvedRecent.length > 0 && (
            <>
              <span className="text-[11px] text-[#6b6b6b] uppercase tracking-[0.06em] px-1">Recent</span>
              {resolvedRecent.map((r) => (
                <button
                  key={`${r.workspaceId}:${r.folderId}`}
                  type="button"
                  onClick={() => onChoose(r)}
                  className="flex items-center gap-2 h-9 px-2 rounded-lg bg-transparent border-none text-left cursor-pointer"
                >
                  <FolderIcon size={15} className="text-[#6b6b6b]" aria-hidden="true" />
                  <span>{r.workspaceName} / {r.folderName}</span>
                </button>
              ))}
            </>
          )}
          <span className="text-[11px] text-[#6b6b6b] uppercase tracking-[0.06em] px-1">Folders</span>
          {filtered.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={f.id === destination.folderId && selectedWorkspaceId === destination.workspaceId}
              onClick={() => onChoose({ workspaceId: selectedWorkspaceId, workspaceName, folderId: f.id, folderName: f.name })}
              className="flex items-center gap-2 h-9 px-2 rounded-lg bg-transparent border-none text-left cursor-pointer"
            >
              <FolderIcon size={15} className="text-[#6b6b6b]" aria-hidden="true" />
              <span>{f.name}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="New folder here"
            className="flex-grow h-9 px-2.5 border border-[#e4e4e4] rounded-[10px] bg-white text-sm outline-none"
          />
          <button
            type="button"
            aria-label="New folder"
            onClick={() => { void handleCreate(); }}
            disabled={newFolderName.trim() === ""}
            className="w-9 h-9 border-none rounded-[10px] bg-[#18181b] text-[#fafafa] cursor-pointer flex items-center justify-center disabled:opacity-40"
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
