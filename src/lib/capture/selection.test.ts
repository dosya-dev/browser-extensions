// @vitest-environment node
import { describe, it, expect } from "vitest";
import { selectionText, truncateSelection } from "./selection";
describe("selection text", () => {
  it("writes title, source, blank line, then the text", () => {
    expect(selectionText({ title: "T", url: "https://x/y", text: "hello\nworld" })).toBe("Title: T\nSource: https://x/y\n\nhello\nworld");
  });
  it("truncates at the cap", () => { expect(truncateSelection("abcdef", 3)).toBe("abc"); expect(truncateSelection("ab", 3)).toBe("ab"); });
});
