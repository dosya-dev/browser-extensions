import { useEffect, useRef, useState } from "react";
import { Globe, Link2, Loader2 } from "lucide-react";
import { send, type SaveItem } from "../../../lib/messages";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

type Expiry = 7 | 30 | null;

async function requestLink(p: { itemId: string; expiresDays: Expiry }): Promise<string> {
  const reply = await send({ type: "copy-link", itemId: p.itemId, expiresDays: p.expiresDays });
  if (!("url" in reply)) throw new Error("Could not create a link");
  return reply.url;
}

/** Safari only honours a clipboard write made inside the click itself, so the write is
 *  started synchronously with a promise for the text; browsers without ClipboardItem get
 *  the plain writeText after the link arrives. */
async function writeToClipboard(text: Promise<string>): Promise<void> {
  const Item = (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
  if (Item && typeof navigator.clipboard?.write === "function") {
    const blob = text.then((t) => new Blob([t], { type: "text/plain" }));
    await navigator.clipboard.write([new Item({ "text/plain": blob })]);
    return;
  }
  await navigator.clipboard.writeText(await text);
}

export default function ShareDialog({ item, onClose }: { item: SaveItem; onClose: () => void }) {
  const [expiry, setExpiry] = useState<Expiry>(7);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (copiedTimeout.current) clearTimeout(copiedTimeout.current); }, []);

  async function copyLink() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const pending = requestLink({ itemId: item.id, expiresDays: expiry });
    try {
      await writeToClipboard(pending);
      setUrl(await pending);
      setCopied(true);
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
      copiedTimeout.current = setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // Either the link could not be made, or the browser refused the clipboard: in the
      // second case the link still exists, so show it for a manual copy.
      const made = await pending.catch(() => null);
      if (made) setUrl(made);
      setError(made ? "Copy it from the box below" : (e instanceof Error ? e.message : "Could not create a link"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-0 z-20">
      <div className="absolute inset-0 bg-[#18181b]/45" onClick={onClose} />
      <div
        role="dialog"
        aria-labelledby="share-title"
        className="absolute left-0 right-0 bottom-0 bg-white border-t border-[#e4e4e4] rounded-t-2xl px-4 pt-[18px] pb-4 flex flex-col gap-3.5 shadow-[0_-12px_32px_rgba(24,24,27,0.18)]"
      >
        <div className="flex items-start gap-2.5">
          <div className="w-10 h-10 rounded-[10px] bg-[#d9d4cb] shrink-0 overflow-hidden">
            {item.thumb && <img src={item.thumb} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <h2 id="share-title" className="m-0 text-[15px] font-semibold">Copy a link</h2>
            <span className="text-xs text-[#6b6b6b] whitespace-nowrap overflow-hidden text-ellipsis">{item.filename} · {formatBytes(item.bytes)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] bg-[#fafafa] border border-[#e4e4e4]">
          <Globe size={18} className="text-[#181818]" aria-hidden="true" />
          <div className="flex flex-col gap-px">
            <span className="font-semibold">Anyone with the link can view</span>
            <span className="text-[11px] text-[#6b6b6b]">No sign-in needed. You can revoke it from Shared in dosya.</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-[#6b6b6b] uppercase tracking-[0.06em]">Link expires</span>
          <div role="group" aria-label="Link expiry" className="grid grid-cols-3 border border-[#e4e4e4] rounded-[10px] overflow-hidden bg-[#fafafa]">
            {([[7, "7 days"], [30, "30 days"], [null, "Never"]] as const).map(([value, text], i) => (
              <button
                key={text}
                type="button"
                aria-pressed={expiry === value}
                onClick={() => setExpiry(value)}
                className={`h-9 border-none ${i > 0 ? "border-l border-l-[#e4e4e4]" : ""} cursor-pointer ${expiry === value ? "bg-[#18181b] text-[#fafafa] font-semibold" : "bg-transparent text-[#181818]"}`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        {error && <div role="alert" className="text-[11px] text-[#b45309]">{error}</div>}
        {url && error && (
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" className="h-9 px-2.5 border border-[#e4e4e4] rounded-[10px] bg-[#fafafa] text-xs outline-none" />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-grow h-[42px] border border-[#e4e4e4] rounded-[10px] bg-white text-[#181818] font-medium cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            onClick={copyLink}
            disabled={busy}
            aria-busy={busy}
            className="flex-grow-[2] flex items-center justify-center gap-2 h-[42px] border-none rounded-[10px] bg-[#18181b] text-[#fafafa] font-semibold cursor-pointer disabled:cursor-progress disabled:opacity-80"
          >
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
            {busy ? "Creating link" : copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}
