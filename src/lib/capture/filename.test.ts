// @vitest-environment node
import { describe, it, expect } from "vitest";
import { safeStem, imageFilename, screenshotFilename, selectionFilename, extFromContentType } from "./filename";
describe("filenames", () => {
  it("image: last path segment, decoded; falls back to title plus content-type", () => {
    expect(imageFilename("https://cdn.x/a/b/golden%20hour.jpg?w=1", "image/jpeg", "Page")).toBe("golden hour.jpg");
    expect(imageFilename("https://cdn.x/img/123", "image/webp", "Autumn | Unsplash")).toBe("Autumn - Unsplash.webp");
    expect(imageFilename("https://cdn.x/", null, "")).toBe("untitled.bin");
    expect(imageFilename("https://cdn.x/a/photo", "image/png", "...")).toBe("untitled.png");
  });
  it("screenshot: title, date and time, png", () => {
    expect(screenshotFilename("Studio lighting", new Date(2026, 9, 7, 9, 5))).toBe("Studio lighting 2026-10-07 09.05.png");
    expect(screenshotFilename("", new Date(2026, 0, 1, 23, 59))).toBe("untitled 2026-01-01 23.59.png");
  });
  it("selection: title.txt", () => { expect(selectionFilename("Lens rental: terms?")).toBe("Lens rental- terms-.txt"); });
  it("safeStem strips illegal characters, trims, caps at 200", () => {
    expect(safeStem('  a/b\\c:d*e?f"g<h>i|j  ')).toBe("a-b-c-d-e-f-g-h-i-j");
    expect(safeStem("x".repeat(250)).length).toBe(200);
    expect(safeStem(". .")).toBe("untitled");
    expect(safeStem("???")).toBe("untitled");
    expect(safeStem("!!! ***")).toBe("untitled");
  });
  it("caps by code points so an emoji is never split", () => {
    const title = "a".repeat(100) + "\u{1F600}".repeat(150);
    const result = safeStem(title);
    expect(Array.from(result).length).toBe(200);
    expect(() => encodeURIComponent(result)).not.toThrow();
  });
  it("extFromContentType", () => { expect(extFromContentType("image/svg+xml")).toBe("svg"); expect(extFromContentType("text/html; charset=utf-8")).toBe("bin"); });
});
