import { Camera, TextSelect } from "lucide-react";

function isMac(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? navigator.userAgent;
  return /mac/i.test(platform);
}

export default function Actions({ onScreenshot, onSelection }: { onScreenshot: () => void; onSelection: () => void }) {
  const shortcut = isMac() ? "Cmd Shift S" : "Ctrl Shift S";
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onScreenshot}
          className="flex flex-col items-start gap-2.5 min-h-[84px] p-3 rounded-xl border-none bg-[#18181b] text-[#fafafa] text-left cursor-pointer"
        >
          <Camera size={20} aria-hidden="true" />
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">Save visible screenshot</span>
            <span className="text-[11px] text-[#a1a1a1]">{shortcut}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onSelection}
          className="flex flex-col items-start gap-2.5 min-h-[84px] p-3 rounded-xl border border-[#e4e4e4] bg-white text-[#181818] text-left cursor-pointer"
        >
          <TextSelect size={20} aria-hidden="true" />
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">Save selection</span>
            <span className="text-[11px] text-[#6b6b6b]">Select text on the page first</span>
          </span>
        </button>
      </div>
      <div className="text-[11px] text-[#6b6b6b]">Right-click any image to save it here too.</div>
    </div>
  );
}
