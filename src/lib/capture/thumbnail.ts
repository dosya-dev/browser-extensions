/** A small JPEG preview of an image capture, kept on the item as a data URL so the popup can
 *  show what was saved after the bytes themselves are gone. Returns undefined wherever the
 *  platform cannot decode the image (SVG, unsupported codecs, no OffscreenCanvas): the popup
 *  then falls back to the type icon. */
export const THUMB_PX = 72;

export function bytesToDataUrl(bytes: ArrayBuffer, type: string): string {
  let bin = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 0x8000) bin += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
}

export async function makeThumbnail(blob: Blob, px: number = THUMB_PX): Promise<string | undefined> {
  const g = globalThis as { createImageBitmap?: typeof createImageBitmap; OffscreenCanvas?: typeof OffscreenCanvas };
  if (!g.createImageBitmap || !g.OffscreenCanvas) return undefined;
  try {
    const bitmap = await g.createImageBitmap(blob);
    try {
      // Cover-crop to a square so every row shows the same shape.
      const side = Math.min(bitmap.width, bitmap.height);
      if (side === 0) return undefined;
      const sx = (bitmap.width - side) / 2, sy = (bitmap.height - side) / 2;
      const canvas = new g.OffscreenCanvas(px, px);
      const ctx = canvas.getContext("2d");
      if (!ctx) return undefined;
      ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, px, px);
      const out = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.72 });
      return bytesToDataUrl(await out.arrayBuffer(), "image/jpeg");
    } finally { bitmap.close(); }
  } catch { return undefined; }
}
