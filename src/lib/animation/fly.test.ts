// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { flySaveToCorner, FLY_MS, MARKER } from "./fly";

const tile = () => document.querySelector(`[${MARKER}]`) as HTMLElement | null;

afterEach(() => { document.body.innerHTML = ""; vi.useRealTimers(); });

describe("the save flight", () => {
  it("draws the capture in the middle, then moves it to the top right and clears up", () => {
    vi.useFakeTimers();
    flySaveToCorner(document, { thumb: "data:image/jpeg;base64,AQID", width: 1000, height: 600 });
    const el = tile()!;
    expect(el, "tile").toBeTruthy();
    expect(el.style.left).toBe("420px");
    expect(el.style.top).toBe("244px");
    expect(el.getAttribute("style")).toContain("data:image/jpeg;base64,AQID");
    // 1000 - 44 - (420 + 80) = 456 across; 34 - (244 + 56) = -266 up.
    vi.advanceTimersByTime(25);
    expect(el.style.transform).toBe("translate(456px, -266px) scale(0.1)");
    vi.advanceTimersByTime(FLY_MS + 200);
    expect(tile()).toBeNull();
  });

  it("flies a plain tile when the capture has no preview, such as selected text", () => {
    vi.useFakeTimers();
    flySaveToCorner(document, { width: 1000, height: 600 });
    expect(tile()!.getAttribute("style")).toContain("linear-gradient");
    vi.advanceTimersByTime(FLY_MS + 200);
  });

  it("draws nothing at all when the reader asked for less motion", () => {
    expect(flySaveToCorner(document, { reduceMotion: true, width: 1000, height: 600 })).toBeNull();
    expect(tile()).toBeNull();
  });

  it("replaces a flight already in the air instead of stacking them", () => {
    vi.useFakeTimers();
    flySaveToCorner(document, { width: 1000, height: 600 });
    flySaveToCorner(document, { width: 1000, height: 600 });
    expect(document.querySelectorAll(`[${MARKER}]`).length).toBe(1);
    vi.advanceTimersByTime(FLY_MS + 200);
  });

  it("can be ended early, and ending it twice is harmless", () => {
    vi.useFakeTimers();
    const stop = flySaveToCorner(document, { width: 1000, height: 600 })!;
    stop();
    expect(tile()).toBeNull();
    expect(() => stop()).not.toThrow();
  });
});
