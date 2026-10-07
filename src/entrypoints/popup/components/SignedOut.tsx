import { useState } from "react";
import { Globe, Check } from "lucide-react";
import { browser } from "wxt/browser";
import { send } from "../../../lib/messages";
import { APP_BASE } from "../../../lib/config";

const API_ORIGINS = ["https://api.dosya.dev/*", "https://app.dosya.dev/*"];

export default function SignedOut() {
  const [denied, setDenied] = useState(false);
  // A temporary Firefox load grants no host permissions, so the two dosya origins are asked
  // for here. The request must be the first thing the click does: it needs the user gesture.
  // On Chromium they are already granted and this resolves true without a prompt.
  const onSignIn = () => {
    const granted = browser.permissions.request({ origins: API_ORIGINS });
    void (async () => {
      if (!(await granted)) { setDenied(true); return; }
      setDenied(false);
      await send({ type: "sign-in" });
    })();
  };
  return (
    <div className="w-[360px] h-[560px] box-border flex flex-col bg-[#fafafa] text-[#181818] text-[13px] leading-[1.4] border border-[#e4e4e4] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-[#e4e4e4] bg-white">
        <img src="/icon/32.png" alt="dosya" className="w-[22px] h-[22px]" />
        <div className="font-semibold text-sm flex-grow">Save to dosya</div>
      </div>

      <div className="flex-grow px-[22px] pt-7 pb-[18px] flex flex-col gap-[18px]">
        <div className="w-14 h-14 rounded-2xl bg-[#18181b] flex items-center justify-center">
          <Globe size={26} className="text-[#fafafa]" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[22px] leading-[1.2] font-semibold tracking-[-0.01em]">
            Save anything from the web into your dosya folders
          </h1>
          <p className="m-0 text-[#6b6b6b]">
            Images, selected text and screenshots land in a folder you pick once. Sign in stays put after you restart the browser.
          </p>
        </div>
        <ul className="m-0 p-0 list-none flex flex-col gap-2">
          <li className="flex items-center gap-2.5">
            <Check size={16} strokeWidth={2.5} className="text-[#16a34a]" aria-hidden="true" />
            <span>Right-click an image to save it</span>
          </li>
          <li className="flex items-center gap-2.5">
            <Check size={16} strokeWidth={2.5} className="text-[#16a34a]" aria-hidden="true" />
            <span>One shortcut saves a screenshot or selection</span>
          </li>
          <li className="flex items-center gap-2.5">
            <Check size={16} strokeWidth={2.5} className="text-[#16a34a]" aria-hidden="true" />
            <span>Copy a share link right after saving</span>
          </li>
        </ul>
        <div className="flex-grow" />
        <button
          type="button"
          onClick={onSignIn}
          className="flex items-center justify-center gap-2 h-11 border-none rounded-[10px] bg-[#18181b] text-[#fafafa] text-sm font-semibold cursor-pointer"
        >
          Sign in with dosya
        </button>
        {denied && (
          <p role="alert" className="m-0 text-[11px] text-[#b42318] text-center">
            dosya needs permission to reach api.dosya.dev to save files
          </p>
        )}
        <p className="m-0 text-[11px] text-[#6b6b6b] text-center">
          Opens app.dosya.dev in a window. Two-factor and passkeys work as usual. The extension never sees your password.
        </p>
      </div>

      <div className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 border-t border-[#e4e4e4] bg-white text-[11px] text-[#6b6b6b]">
        New to dosya?{" "}
        <a href={`${APP_BASE}/sign-up`} target="_blank" rel="noreferrer" className="font-medium no-underline text-[#15803d]">
          Create an account
        </a>
      </div>
    </div>
  );
}
