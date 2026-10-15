import { Trash2, ExternalLink } from "lucide-react";
import type { AuthUser } from "../../../lib/messages";
import { DELETE_ACCOUNT_URL } from "../../../lib/config";

/**
 * Who you are signed in as, and the way out.
 *
 * Deleting an account is not something an extension should do behind a token:
 * it needs the account's own password and a confirmation, so the button opens
 * the deletion page on dosya itself. What matters is that the route STARTS
 * here, one tap from the account, rather than being something to go looking
 * for on the website.
 */
export default function AccountPanel({ user, onClose }: { user: AuthUser; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30">
      <div className="absolute inset-0 bg-[#18181b]/35" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Account"
        className="absolute right-3 top-12 w-[240px] bg-white border border-[#e4e4e4] rounded-xl shadow-[0_12px_32px_rgba(24,24,27,0.18)] p-3.5 flex flex-col gap-3"
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-semibold text-[13px] whitespace-nowrap overflow-hidden text-ellipsis">{user.name}</span>
          <span className="text-[11px] text-[#6b6b6b] whitespace-nowrap overflow-hidden text-ellipsis">{user.email}</span>
        </div>
        <a
          href={DELETE_ACCOUNT_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 h-9 rounded-[10px] border border-[#e4e4e4] bg-white text-[#b42318] text-[12px] font-medium no-underline"
        >
          <Trash2 size={14} aria-hidden="true" />
          Delete account
          <ExternalLink size={12} aria-hidden="true" />
        </a>
        <p className="m-0 text-[11px] leading-[1.35] text-[#6b6b6b]">
          Deleting opens dosya in a tab, where you confirm it. Your files are removed with the account.
        </p>
      </div>
    </div>
  );
}
