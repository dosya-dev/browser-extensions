import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";
export default defineConfig({
  plugins: [WxtVitest()],
  test: { globals: true, environment: "jsdom", setupFiles: ["./vitest.setup.ts"], include: ["src/**/*.test.{ts,tsx}"] },
});
