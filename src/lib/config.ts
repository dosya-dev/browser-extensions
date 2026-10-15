export const API_BASE = "https://api.dosya.dev";
export const APP_BASE = "https://app.dosya.dev";
/** The marketing site, where Help and About live. */
export const SITE_BASE = "https://dosya.dev";
/** Where a person deletes their account. Apple requires deletion to be reachable
 *  from inside the app; the flow itself may finish on the web, as long as the
 *  link lands on the deletion page itself rather than a page to hunt through. */
export const DELETE_ACCOUNT_URL = `${APP_BASE}/profile/delete`;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_SELECTION_CHARS = 1_000_000;
export type Client = "chrome" | "edge" | "firefox" | "safari";

/**
 * Which browser this copy is running in.
 *
 * Three of the four run the same Chromium build, so only the user agent tells
 * them apart. Edge adds `Edg/`. Safari, which wraps that build in a Mac app,
 * is the one that says `Safari/` without `Chrome/`; before this was checked it
 * fell through to "chrome", and a Safari user saw "Connect Save to dosya for
 * Chrome" on the consent page with a session named "Chrome extension".
 */
export function currentClient(env: { target: string; userAgent: string } = {
  target: import.meta.env.BROWSER, userAgent: navigator.userAgent,
}): Client {
  if (env.target === "firefox") return "firefox";
  if (/\bEdg\//.test(env.userAgent)) return "edge";
  if (/\bSafari\//.test(env.userAgent) && !/\bChrome\//.test(env.userAgent)) return "safari";
  return "chrome";
}
