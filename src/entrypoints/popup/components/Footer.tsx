import { useState } from "react";
import { Settings } from "lucide-react";
import type { PopupState } from "../../../lib/messages";

function isToday(ts: number): boolean {
  const d = new Date(ts); const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function Footer({ state, onSignOut }: { state: PopupState; onSignOut: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const savedToday = state.recent.filter((i) => i.state === "done" && isToday(i.createdAt)).length;
  const waiting = state.waiting + state.queued;
  const label = waiting > 0 ? `${savedToday} saved today · ${waiting} waiting` : `${savedToday} saved today`;
  return (
    <div className="relative flex items-center gap-2 px-3.5 py-2.5 border-t border-[#e4e4e4] bg-white">
      <span className="w-2 h-2 rounded-full bg-[#16a34a]" aria-hidden="true" />
      <span className="text-[11px] text-[#6b6b6b] flex-grow">{label}</span>
      <button
        type="button"
        aria-label="Settings"
        onClick={() => setMenuOpen((v) => !v)}
        className="w-[30px] h-[30px] border-none rounded-lg bg-transparent cursor-pointer flex items-center justify-center"
      >
        <Settings size={16} className="text-[#6b6b6b]" aria-hidden="true" />
      </button>
      {menuOpen && (
        <div role="menu" className="absolute bottom-full right-3.5 mb-1 bg-white border border-[#e4e4e4] rounded-[10px] shadow-lg py-1 min-w-[120px]">
          <button
            type="button"
            role="menuitem"
            onClick={() => { setMenuOpen(false); onSignOut(); }}
            className="w-full text-left px-3 py-1.5 border-none bg-transparent cursor-pointer text-[#181818]"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
