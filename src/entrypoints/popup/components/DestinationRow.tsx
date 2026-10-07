import { Folder, ChevronDown } from "lucide-react";
import type { Destination } from "../../../lib/messages";

export default function DestinationRow({ destination, onOpen }: { destination: Destination | null; onOpen: () => void }) {
  const label = destination ? `${destination.workspaceName} / ${destination.folderName}` : "Choose a folder";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-[#6b6b6b] uppercase tracking-[0.06em]">Saving to</span>
      <button
        type="button"
        onClick={onOpen}
        className="flex-grow flex items-center gap-2 h-9 px-2.5 border border-[#e4e4e4] rounded-[10px] bg-white text-[#181818] font-medium text-left cursor-pointer"
      >
        <Folder size={16} className="text-[#6b6b6b] shrink-0" aria-hidden="true" />
        <span className="flex-grow whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
        <ChevronDown size={14} className="text-[#6b6b6b] shrink-0" aria-hidden="true" />
      </button>
    </div>
  );
}
