import type React from "react";
import { FileText, Image as ImageIcon, Check, RefreshCw, Link2 } from "lucide-react";
import type { SaveItem } from "../../../lib/messages";
import { APP_BASE } from "../../../lib/config";

function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return new Date(ts).toLocaleDateString();
}

/** A saved row opens the file in dosya; rows still in flight are plain. */
function Body({ item, retryable, children }: { item: SaveItem; retryable: boolean; children: React.ReactNode }) {
  const cls = "flex items-center gap-2.5 flex-grow min-w-0";
  if (item.state !== "done" || !item.fileId || retryable) return <div className={cls}>{children}</div>;
  return (
    <a href={fileViewUrl(item.fileId)} target="_blank" rel="noreferrer" title="Open in dosya" className={`${cls} group no-underline text-inherit rounded-lg -my-1 py-1 -ml-1 pl-1 pr-1 transition-colors hover:bg-[#f0f0ee] focus-visible:bg-[#f0f0ee] outline-none`}>
      {children}
    </a>
  );
}
export const fileViewUrl = (fileId: string) => `${APP_BASE}/files?view=${encodeURIComponent(fileId)}`;

function Row({ item, onCopyLink, onRetry }: { item: SaveItem; onCopyLink: (item: SaveItem) => void; onRetry: (itemId: string) => void }) {
  const retryable = item.state === "failed" || (item.state === "queued" && item.nextAttemptAt > Date.now());
  const isDone = item.state === "done";
  return (
    <div className={`flex items-center gap-2.5 py-2 px-1.5 rounded-[10px] ${isDone ? "bg-white border border-[#e4e4e4]" : ""}`}>
      <Body item={item} retryable={retryable}>
        <div className="w-9 h-9 rounded-lg bg-white border border-[#e4e4e4] flex items-center justify-center shrink-0 overflow-hidden">
          {item.thumb ? (
            <img src={item.thumb} alt="" className="w-full h-full object-cover" />
          ) : item.kind === "selection" ? (
            <FileText size={16} className="text-[#6b6b6b]" aria-hidden="true" />
          ) : (
            <ImageIcon size={16} className="text-[#6b6b6b]" aria-hidden="true" />
          )}
        </div>
        <div className="flex-grow min-w-0 flex flex-col gap-px">
          <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis group-hover:underline group-hover:decoration-[#a1a1a1] underline-offset-2">{item.filename}</span>
          {retryable ? (
            <span className="text-[11px] text-[#b45309]">{item.message ?? "Waiting"} · retrying</span>
          ) : (
            <span className="text-[11px] text-[#6b6b6b]">{item.folderName ?? "Folder"} · {relativeTime(item.createdAt)}</span>
          )}
        </div>
      </Body>
      {isDone && (
        <button
          type="button"
          aria-label="Copy link"
          onClick={() => onCopyLink(item)}
          className="w-8 h-8 shrink-0 border border-[#e4e4e4] rounded-lg bg-[#fafafa] cursor-pointer flex items-center justify-center"
        >
          <Link2 size={15} className="text-[#181818]" aria-hidden="true" />
        </button>
      )}
      {isDone && <Check size={16} strokeWidth={2.5} className="text-[#16a34a] shrink-0" aria-hidden="true" />}
      {retryable && (
        <button
          type="button"
          aria-label="Retry now"
          onClick={() => onRetry(item.id)}
          className="w-8 h-8 shrink-0 border-none rounded-lg bg-transparent cursor-pointer flex items-center justify-center"
        >
          <RefreshCw size={16} className="text-[#b45309]" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default function RecentSaves({ items, onCopyLink, onRetry }: { items: SaveItem[]; onCopyLink: (item: SaveItem) => void; onRetry: (itemId: string) => void }) {
  return (
    <>
      <div className="flex items-center px-3.5 pt-1.5 pb-1">
        <span className="text-[11px] text-[#6b6b6b] uppercase tracking-[0.06em] flex-grow">Recent saves</span>
        <a href={`${APP_BASE}/files`} target="_blank" rel="noreferrer" className="text-[11px] font-medium no-underline text-[#15803d]">Open dosya</a>
      </div>
      <div className="flex-grow overflow-auto px-2 flex flex-col gap-0.5">
        {items.map((item) => (
          <Row key={item.id} item={item} onCopyLink={onCopyLink} onRetry={onRetry} />
        ))}
      </div>
    </>
  );
}
