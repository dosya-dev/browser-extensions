// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { readCallback } from "./done-callback";

describe("done page callback", () => {
  it("takes the code and state from the URL before the page has rendered anything", () => {
    const doc = { getElementById: () => null } as unknown as Document;
    expect(readCallback("?code=abc&state=xyz", doc)).toEqual({ code: "abc", state: "xyz" });
  });
  it("falls back to the rendered element when the URL carries nothing", () => {
    const el = document.createElement("div"); el.id = "dosya-extension-callback";
    el.setAttribute("data-code", "c1"); el.setAttribute("data-state", "s1"); document.body.appendChild(el);
    expect(readCallback("", document)).toEqual({ code: "c1", state: "s1" });
  });
  it("sends nothing when neither source has both values", () => {
    const doc = { getElementById: () => null } as unknown as Document;
    expect(readCallback("?code=only", doc)).toBeNull();
  });
});
