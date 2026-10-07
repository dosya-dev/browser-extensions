export const API_BASE = "https://api.dosya.dev";
export const APP_BASE = "https://app.dosya.dev";
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_SELECTION_CHARS = 1_000_000;
export type Client = "chrome" | "edge" | "firefox";

/** Edge ships the Chromium build; it is told apart by its user agent. */
export function currentClient(env: { target: string; userAgent: string } = {
  target: import.meta.env.BROWSER, userAgent: navigator.userAgent,
}): Client {
  if (env.target === "firefox") return "firefox";
  return /\bEdg\//.test(env.userAgent) ? "edge" : "chrome";
}
