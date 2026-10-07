import { test, expect, chromium } from "@playwright/test";
import path from "node:path";

const EXT = path.resolve(import.meta.dirname, "../../.output/chrome-mv3");

test("popup renders signed out and sign-in opens the dosya consent page", async () => {
  const ctx = await chromium.launchPersistentContext("", {
    headless: false,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });

  try {
    let sw = ctx.serviceWorkers()[0];
    if (!sw) sw = await ctx.waitForEvent("serviceworker");
    const id = new URL(sw.url()).host;

    const page = await ctx.newPage();
    await page.goto(`chrome-extension://${id}/popup.html`);
    await expect(page.getByText("Sign in with dosya")).toBeVisible();

    const popupEvent = ctx.waitForEvent("page");
    await page.getByRole("button", { name: "Sign in with dosya" }).click();
    const consent = await popupEvent;
    await consent.waitForURL(/app\.dosya\.dev\/connect\/extension/);

    const u = new URL(consent.url());
    expect(u.origin + u.pathname).toBe("https://app.dosya.dev/connect/extension");
    expect(u.searchParams.get("client")).toBe("chrome");
    expect(u.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(u.searchParams.get("state")).toBeTruthy();
    expect(u.searchParams.get("redirect_uri")).toBe(`https://${id}.chromiumapp.org/callback`);
  } finally {
    await ctx.close();
  }
});
