import { useEffect, useState } from "react";
import { send, type SaveItem } from "../../../lib/messages";
import { originPattern, peekBlocked, requestOrigins, takeBlocked } from "../../../lib/permissions";

function hostOf(pattern: string): string {
  return pattern.replace(/^[a-z]+:\/\//, "").replace(/\/\*$/, "");
}

export default function PermissionBanner({ items, onChanged }: { items: SaveItem[]; onChanged: () => void }) {
  const [patterns, setPatterns] = useState<string[]>([]);

  useEffect(() => { void peekBlocked().then(setPatterns); }, [items]);

  if (patterns.length === 0) return null;

  async function allow() {
    const granted = requestOrigins(patterns);
    if (await granted) {
      const toRetry = items.filter((i) => i.message === "blocked" && i.imageUrl && patterns.includes(originPattern(i.imageUrl)));
      for (const item of toRetry) await send({ type: "retry", itemId: item.id });
      await takeBlocked(patterns);
      onChanged();
    }
  }

  async function dismiss() {
    await takeBlocked(patterns);
    onChanged();
  }

  const hosts = patterns.map(hostOf).join(", ");

  return (
    <div className="flex flex-col gap-2 p-2.5 rounded-[10px] border border-[#e4e4e4] bg-white">
      <p className="m-0 text-[12px] text-[#181818]">
        A site blocked saving an image. Allow dosya to read images from {hosts}?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { void allow(); }}
          className="h-8 px-3 border-none rounded-lg bg-[#18181b] text-[#fafafa] text-[12px] font-semibold cursor-pointer"
        >
          Allow
        </button>
        <button
          type="button"
          onClick={() => { void dismiss(); }}
          className="h-8 px-3 border border-[#e4e4e4] rounded-lg bg-[#fafafa] text-[#181818] text-[12px] cursor-pointer"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
