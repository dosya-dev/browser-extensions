import { describe, it, expect } from "vitest";
import { MENU_TITLES, menuIcons } from "./menus";

describe("context menu entries", () => {
  it("every entry says where the save goes", () => {
    for (const t of Object.values(MENU_TITLES)) expect(t.endsWith(" to dosya")).toBe(true);
  });
  it("only Firefox gets an icons key, since Chromium rejects it and draws its own", () => {
    expect(menuIcons("firefox")).toEqual({ icons: { 16: "icon/16.png", 32: "icon/32.png" } });
    expect(menuIcons("chrome")).toEqual({});
  });
});
