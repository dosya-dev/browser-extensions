import { send } from "../lib/messages";
import { readCallback } from "../lib/auth/done-callback";

export default defineContentScript({
  matches: ["https://app.dosya.dev/connect/extension/done*"],
  main() {
    const cb = readCallback(location.search, document);
    if (cb) void send({ type: "extension-callback", ...cb });
  },
});
