import { browser } from "wxt/browser";
export const MENU = { image: "save-image", selection: "save-selection", screenshot: "save-screenshot" } as const;
export const MENU_TITLES = {
  image: "Save image to dosya",
  selection: "Save selection to dosya",
  screenshot: "Save screenshot to dosya",
} as const;
/** Chromium draws the extension's own icon next to its entries and rejects an `icons` key;
 *  Firefox draws nothing unless the entry carries one. Safari lists the entries under the
 *  extension's name and icon. */
export function menuIcons(target: string = import.meta.env.BROWSER): { icons: Record<string, string> } | Record<string, never> {
  return target === "firefox" ? { icons: { 16: "icon/16.png", 32: "icon/32.png" } } : {};
}
export async function installMenus(): Promise<void> {
  await browser.contextMenus.removeAll();
  const icons = menuIcons();
  browser.contextMenus.create({ id: MENU.image, title: MENU_TITLES.image, contexts: ["image"], ...icons });
  browser.contextMenus.create({ id: MENU.selection, title: MENU_TITLES.selection, contexts: ["selection"], ...icons });
  browser.contextMenus.create({ id: MENU.screenshot, title: MENU_TITLES.screenshot, contexts: ["page", "action"], ...icons });
}
