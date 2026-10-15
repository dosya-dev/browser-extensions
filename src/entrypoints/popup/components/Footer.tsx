import { useState } from "react";
import { Settings } from "lucide-react";
import type { PopupState } from "../../../lib/messages";
import { SITE_BASE } from "../../../lib/config";

function isToday(ts: number): boolean {
  const d = new Date(ts); const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function Footer({ state, onSignOut, onToggleAnimations }: { state: PopupState; onSignOut: () => void; onToggleAnimations: (on: boolean) => void }) {
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
        <div role="menu" className="absolute bottom-full right-3.5 mb-1 bg-white border border-[#e4e4e4] rounded-[10px] shadow-lg py-1 min-w-[140px]">
          <a
            role="menuitem"
            href={`${SITE_BASE}/help/`}
            target="_blank"
            rel="noreferrer"
            onClick={() => setMenuOpen(false)}
            className="block px-3 py-1.5 no-underline text-[#181818]"
          >
            Help
          </a>
          <a
            role="menuitem"
            href={`${SITE_BASE}/about/`}
            target="_blank"
            rel="noreferrer"
            onClick={() => setMenuOpen(false)}
            className="block px-3 py-1.5 no-underline text-[#181818]"
          >
            About
          </a>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={state.animations}
            onClick={() => onToggleAnimations(!state.animations)}
            className="w-full flex items-center gap-2 text-left px-3 py-1.5 border-none bg-transparent cursor-pointer text-[#181818]"
          >
            <span className="flex-grow">Animations</span>
            <span
              className={`w-7 h-4 rounded-full relative shrink-0 ${state.animations ? "bg-[#16a34a]" : "bg-[#d4d4d4]"}`}
              aria-hidden="true"
            >
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white ${state.animations ? "right-0.5" : "left-0.5"}`} />
            </span>
          </button>
          <div className="my-1 border-t border-[#e4e4e4]" />
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
