/**
 * What a finished save looks like on the page it came from.
 *
 * The capture flies from the middle of the viewport to the top right corner,
 * shrinking as it goes, which is where three of the four browsers keep the
 * extension's toolbar button. A page cannot read that button's real position,
 * so the corner is the closest honest aim; Safari keeps its button left of the
 * address field, and there the flight lands a little short of it.
 *
 * Drawn with two inline elements and a transition rather than a stylesheet, so
 * it cannot inherit or disturb anything the host page has styled, and it is
 * removed the moment it finishes.
 */
export const FLY_MS = 900;
const TILE_W = 160;
const TILE_H = 112;
/** Roughly where a toolbar button sits, measured in from the top right. */
const TARGET_INSET_X = 44;
const TARGET_INSET_Y = 34;
export const MARKER = "data-dosya-save";

export interface FlyOptions {
  /** The capture, as a data URL. Absent for a text selection, which flies as a plain tile. */
  thumb?: string;
  /** Viewport, injectable because jsdom reports zero for both. */
  width?: number;
  height?: number;
  /** True when the reader asked their system for less motion. */
  reduceMotion?: boolean;
}

/**
 * Starts the flight and returns a function that ends it early. Returns null,
 * having drawn nothing, when motion is unwanted or there is no document to
 * draw into.
 */
export function flySaveToCorner(doc: Document, opts: FlyOptions = {}): (() => void) | null {
  if (opts.reduceMotion) return null;
  const body = doc.body;
  if (!body) return null;

  // Never stack: a burst of saves replaces its predecessor rather than piling up.
  for (const old of Array.from(doc.querySelectorAll(`[${MARKER}]`))) old.remove();

  const w = opts.width ?? doc.defaultView?.innerWidth ?? 1200;
  const h = opts.height ?? doc.defaultView?.innerHeight ?? 800;
  const startX = Math.round(w / 2 - TILE_W / 2);
  const startY = Math.round(h / 2 - TILE_H / 2);
  const dx = Math.round(w - TARGET_INSET_X - (startX + TILE_W / 2));
  const dy = Math.round(TARGET_INSET_Y - (startY + TILE_H / 2));

  const tile = doc.createElement("div");
  tile.setAttribute(MARKER, "");
  tile.setAttribute("aria-hidden", "true");
  const face = opts.thumb
    ? `background-image:url("${opts.thumb}");background-size:cover;background-position:center;`
    : "background:linear-gradient(160deg,#2f3136,#5a5d66);";
  tile.setAttribute(
    "style",
    "position:fixed;z-index:2147483647;pointer-events:none;" +
      `left:${startX}px;top:${startY}px;width:${TILE_W}px;height:${TILE_H}px;` +
      "border-radius:10px;border:2px solid #ffffff;box-shadow:0 14px 34px rgba(24,24,27,0.30);" +
      `${face}opacity:1;transform:translate(0,0) scale(1);` +
      `transition:transform ${FLY_MS}ms cubic-bezier(0.34,0.01,0.2,1),opacity ${FLY_MS}ms ease-in;`,
  );
  body.appendChild(tile);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(moveAt);
    clearTimeout(endAt);
    tile.remove();
  };
  // One frame of stillness first, or the browser has nothing to animate from.
  const moveAt = setTimeout(() => {
    tile.style.transform = `translate(${dx}px, ${dy}px) scale(0.1)`;
    tile.style.opacity = "0.15";
  }, 20);
  const endAt = setTimeout(finish, FLY_MS + 120);
  return finish;
}
