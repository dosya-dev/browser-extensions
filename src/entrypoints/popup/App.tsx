import { useState } from "react";
import { send, type SaveItem, type Destination } from "../../lib/messages";
import { rememberFolder } from "../../lib/store/prefs";
import { usePopupState } from "./state";
import Header from "./components/Header";
import DestinationRow from "./components/DestinationRow";
import Actions from "./components/Actions";
import RecentSaves from "./components/RecentSaves";
import Footer from "./components/Footer";
import SignedOut from "./components/SignedOut";
import ShareDialog from "./components/ShareDialog";
import FolderPicker from "./components/FolderPicker";
import PermissionBanner from "./components/PermissionBanner";

export default function App() {
  const { state, reload } = usePopupState();
  const [shareItem, setShareItem] = useState<SaveItem | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!state) return null;
  if (!state.signedIn) return <SignedOut />;

  async function chooseDestination(d: Destination) {
    await rememberFolder(d);
    await send({ type: "set-destination", destination: d });
    setPickerOpen(false);
    await reload();
  }

  return (
    <main className="relative w-[360px] h-[560px] box-border flex flex-col bg-[#fafafa] text-[#181818] text-[13px] leading-[1.4] border border-[#e4e4e4] rounded-xl overflow-hidden">
      <Header user={state.user!} />

      <div className="px-3.5 pt-3.5 pb-2.5 flex flex-col gap-2.5">
        <DestinationRow destination={state.destination} onOpen={() => setPickerOpen(true)} />
        <PermissionBanner items={state.recent} onChanged={() => { void reload(); }} />
        <Actions
          onScreenshot={() => { void send({ type: "save-screenshot" }); }}
          onSelection={() => { void send({ type: "save-selection" }); }}
        />
      </div>

      {shareItem && <ShareDialog item={shareItem} onClose={() => setShareItem(null)} />}
      {pickerOpen && state.destination && (
        <FolderPicker
          destination={state.destination}
          onChoose={(d) => { void chooseDestination(d); }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <RecentSaves
        items={state.recent}
        onCopyLink={(item) => setShareItem(item)}
        onRetry={(itemId) => { void send({ type: "retry", itemId }); }}
      />

      <Footer state={state} onSignOut={() => { void send({ type: "sign-out" }); }} />
    </main>
  );
}
