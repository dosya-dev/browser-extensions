const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f]/g;
export const MAX_STEM = 200;
export function safeStem(s: string): string {
  const cleaned = s.replace(ILLEGAL, "-").replace(/\s+/g, " ").trim();
  const capped = Array.from(cleaned).slice(0, MAX_STEM).join("");
  const result = capped.replace(/^[. ]+|[. ]+$/g, "").trim();
  if (!/[\p{L}\p{N}]/u.test(result)) return "untitled";
  return result;
}
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "image/avif": "avif" };
export function extFromContentType(ct: string | null): string { return EXT[(ct ?? "").split(";")[0].trim().toLowerCase()] ?? "bin"; }
export function imageFilename(url: string, contentType: string | null, pageTitle: string): string {
  let last = "";
  try { last = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? ""); } catch { last = ""; }
  const m = /^(.*)\.([A-Za-z0-9]{2,5})$/.exec(last);
  if (m && safeStem(m[1]) !== "untitled") return `${safeStem(m[1])}.${m[2].toLowerCase()}`;
  return `${safeStem(pageTitle)}.${extFromContentType(contentType)}`;
}
const two = (n: number) => String(n).padStart(2, "0");
export function screenshotFilename(pageTitle: string, at: Date): string {
  return `${safeStem(pageTitle)} ${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())} ${two(at.getHours())}.${two(at.getMinutes())}.png`;
}
export function selectionFilename(pageTitle: string): string { return `${safeStem(pageTitle)}.txt`; }
