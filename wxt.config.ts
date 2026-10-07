import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import { stripInstallTimeAllUrls } from "./src/lib/manifest-hooks";

// The Chrome Web Store refuses an upload whose manifest carries "key": the store
// mints the key and the extension id itself. After the first upload, copy the
// public key from the dashboard (Package > View public key) into
// CHROMIUM_PUBLIC_KEY so unpacked builds get the same id as the store item.
// It is applied to local builds only and stripped from every store zip.
// Store items: Chrome Web Store dkedbgjibdhomlepbbobfobmcgjgimem, Edge Add-ons
// dapdhleiinckjcmlfnooelpaneahhnaf (Edge signs with its own key, so its id differs).
const CHROMIUM_PUBLIC_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzLg6uq2xtocM0KdIx2mo0sSrN20MTiSNybkqPeFXofo3uXn8kiYe9B+WsmAewPoOgOsEOb2d9Vn8k/NvWyYZS636PXBmxgLZVZeGRQd8fq2QuoXNH3qFNJC94B0SLCAfoeQpwi7OgdBbpoT33GrP9X6EGKjhfova+YZrH/FQX5wwiV0FFwcQj5L0rOAq7Ru+BVNYiwEoqQeNgwE+ZyukHeE8xTQxN3qvIkVoge/eEUZR7JGlop7hjLJMDOOqD+3Tu6yoFG9JodtbwbBYENGiRDdpbVMyBnsgNyBO61KBwrpGFxKRtRSZ08jBaOMNPOXF0GkUbOyBWGzp8oFCpmAoywIDAQAB";
const STORE_ZIP = process.env.EXTENSION_STORE_ZIP === "1";
const pinnedKey = !STORE_ZIP && CHROMIUM_PUBLIC_KEY ? { key: CHROMIUM_PUBLIC_KEY } : {};

export default defineConfig({
  srcDir: "src",
  hooks: {
    // The page script registers at runtime, so WXT would copy its `<all_urls>` matches
    // into host_permissions and the store would ask for every site at install.
    // WXT types the manifest as the MV2|MV3 union, so narrow it to the one field we touch.
    "build:manifestGenerated": (_wxt, manifest) => stripInstallTimeAllUrls(manifest as { host_permissions?: string[] }),
  },
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  vite: () => ({ plugins: [tailwindcss()] }),
  zip: {
    name: "save-to-dosya",
    // The Firefox sources zip is what Mozilla rebuilds during review. The extension
    // depends on packages/shared through a file: link, so the zip is rooted at the
    // monorepo and carries both directories; everything else in the repo stays out.
    sourcesRoot: "../..",
    includeSources: ["apps/extension/**", "packages/shared/**"],
    excludeSources: ["**/node_modules/**", "**/.output/**", "**/.wxt/**", "**/test-results/**", "**/coverage/**"],
  },
  manifest: ({ browser }) => ({
    name: "Save to dosya",
    description: "Save images, text and screenshots from any page into your dosya folders.",
    permissions: [
      "activeTab", "contextMenus", "storage", "unlimitedStorage", "scripting",
      "identity", "notifications", "alarms",
      ...(browser === "firefox" ? [] : ["offscreen"]),
    ],
    host_permissions: ["https://api.dosya.dev/*", "https://app.dosya.dev/*"],
    optional_host_permissions: ["<all_urls>"],
    commands: {
      "save-default": {
        suggested_key: { default: "Ctrl+Shift+S", mac: "Command+Shift+S" },
        description: "Save the selection, or a screenshot, to your default folder",
      },
    },
    icons: { 16: "icon/16.png", 32: "icon/32.png", 48: "icon/48.png", 128: "icon/128.png" },
    action: { default_title: "Save to dosya" },
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "save@dosya.dev",
              // data_collection_permissions is understood from Firefox 140 (AMO warns below
              // that); optional_host_permissions from 128, so 140 covers both.
              strict_min_version: "140.0",
              // AMO refuses a submission without this block; the categories match the
              // store pack: sign-in tokens, and the content the user chose to save.
              data_collection_permissions: { required: ["authenticationInfo", "websiteContent"] },
            },
          },
        }
      : pinnedKey),
  }),
});
