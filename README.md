# Save to dosya (browser extension)

A browser extension for [dosya.dev](https://dosya.dev) that saves an image, a
text selection or a screenshot from the current page into a folder in the
user's dosya account, from a right-click menu, a keyboard shortcut, or the
toolbar popup.

Built with WXT (Manifest V3), React and Tailwind. One codebase builds three
targets: Chrome, Edge and Firefox. This app has its own `package.json` and is
not part of the npm workspace, the same convention as `apps/cli` and
`apps/desktop`.

## Install

The extension depends on [`@dosya-dev/shared`](https://github.com/dosya-dev/shared)
through a `file:../../packages/shared` link, the same layout as the other
clients. In the dosya monorepo that path already exists; from this repository
on its own, clone `shared` to `../../packages/shared` relative to this folder
first. Then, from this directory:

```bash
npm install
```

## Build

```bash
npm run build:chrome    # .output/chrome-mv3, also loaded as-is into Edge
npm run build:firefox   # .output/firefox-mv3
npm run build            # both of the above
```

There is no separate Edge build: Chrome and Edge share the same
`chrome-mv3` output. WXT emits the Manifest V3 service worker for the
Chromium targets and a Manifest V3 event page for Firefox (WXT defaults
Firefox to Manifest V2 unless told otherwise; this project's
`wxt.config.ts` sets `manifestVersion: 3` for every target explicitly).

To produce a store-upload zip instead of an unpacked folder:

```bash
npm run zip:chrome      # .output/save-to-dosya-<version>-chrome.zip, uploaded to Chrome and Edge
npm run zip:firefox     # .output/save-to-dosya-<version>-firefox.zip plus -sources.zip
```

The Firefox zip comes with a second `-sources.zip`. Mozilla requires it
because the build output is bundled and minified: a reviewer rebuilds the
extension from that source and compares it with the upload. The sources zip
is rooted at the monorepo and contains only `apps/extension` and
`packages/shared` (the extension's one `file:` dependency); nothing else in
the repository goes in. Paste these steps into the AMO "notes to reviewer"
field with every Firefox submission:

```text
Node 22 (see apps/extension/package.json engines). From the unzipped root:
  cd apps/extension
  npm ci
  npm run build:firefox
The extension is in apps/extension/.output/firefox-mv3.
```

The Chrome Web Store refuses a package whose manifest carries a `key`, so
the store zips never include one: the store mints the key and the extension
id on the first upload. After that upload, copy the public key from the
dashboard (Package, "View public key") into `CHROMIUM_PUBLIC_KEY` in
`wxt.config.ts`. Local builds then get the same id as the store item, which
matters because the sign-in callback
`https://<id>.chromiumapp.org/callback` has to sit in the API's exact
allowlist (`EXTENSION_REDIRECT_URIS`). The key is applied to local builds
only; `npm run zip:*` sets `EXTENSION_STORE_ZIP=1` and strips it.

## Load the build in a browser

**Chrome or Edge, unpacked:**
1. Run `npm run build:chrome`.
2. Open `chrome://extensions` (or `edge://extensions` in Edge).
3. Turn on Developer mode.
4. Click "Load unpacked" and select `.output/chrome-mv3`.

**Firefox, temporary:**
1. Run `npm run build:firefox`.
2. Open `about:debugging`.
3. Click "This Firefox", then "Load Temporary Add-on...".
4. Select `.output/firefox-mv3/manifest.json`.

A temporary Firefox add-on is unloaded when Firefox restarts and needs to be
reloaded by repeating these steps. A temporary load grants no host permissions,
so the first click on "Sign in with dosya" asks Firefox for the `api.dosya.dev`
and `app.dosya.dev` origins; accept the prompt or the API calls fail on CORS.

## Safari

Safari loads the same `chrome-mv3` build, wrapped in a macOS app that lives in
`safari/` (generated once with `xcrun safari-web-extension-converter`, then
kept in the repo so its bundle ids, team, icon and version persist). The Xcode
project references `.output/chrome-mv3` directly, so build the extension first:

```bash
npm run safari:build     # Debug app in safari/build/Build/Products/Debug/
npm run safari:archive   # Release archive for App Store Connect
```

To run a local build: open the app once, then in Safari enable
Develop > Allow Unsigned Extensions and turn it on under Settings > Extensions.
Unsigned builds must be ad-hoc signed (the default here) or macOS will not
register the extension at all. Safari has no identity, offscreen or
notifications API: sign-in goes through the done-page tab flow, uploads run on
the background script, and results show only in the popup.

Bundle ids: app `dev.dosya.save-to-dosya`, extension
`dev.dosya.save-to-dosya.Extension`; App Store Connect app 6820120081.

## Tests

Unit tests (vitest, fake IndexedDB and fake fetch):

```bash
npm test
```

Playwright smoke test, against the unpacked Chromium build (the spec runs
headed, since a headless Chromium cannot load an unpacked extension):

```bash
npm run build:chrome
npx playwright install chromium
npm run test:e2e
```

This loads the unpacked `.output/chrome-mv3` build, opens the popup, checks
that the signed-out view renders, clicks "Sign in with dosya", and asserts
the consent URL it opens (client, code challenge, state and redirect URI).
It needs no running API and never actually signs in or saves anything. The
full sign-in, save and copy-link flow is covered by the manual checklist in
`docs/extension-store/MATRIX.md`, run per browser before each store
submission.

Typecheck:

```bash
npm run typecheck
```

## Store listing pack and the manual test matrix

The single-purpose statement, the per-permission justification table, the
privacy policy text, the listing copy and the data-collection disclosure
answers for Chrome, Edge and Firefox live in `docs/extension-store/STORE.md`
in the repo root. The manual lifetime matrix that has to be run by hand on
every target before each store submission (large upload survives a closed
popup and a closed source tab, a restart mid-upload resumes without a
duplicate, sign-in survives a restart, the shortcut works with and without a
selection, a blocked cross-origin image recovers after the permission
prompt) lives in `docs/extension-store/MATRIX.md`. The list of screenshots
still needed for the listings is in
`docs/extension-store/screenshots/README.md`. All three are local working
documents under the repo's `docs/` tree and are left untracked on purpose,
so they are not committed with the rest of this app's code.

## Release order

The extension's sign-in flow depends on two API changes that must be live in
production before the extension can authenticate anyone: migration 0193
(the `client` column on one-time codes, the `scope` column on tokens, and
the upload idempotency table) and the two extension auth routes
(`POST /api/auth/extension/authorize` and
`POST /api/auth/extension/exchange`). Deploy the API with those in place
before distributing any build of this extension, including to a pilot
group.

## Transparency

Every dosya.dev client is source-available. Your files are yours - this repository lets
you verify exactly what the extension sends to and receives from our servers: which
captures get uploaded, what metadata travels with them, and what comes back. The
extension only ever talks to `api.dosya.dev` and `app.dosya.dev`; if a claim we make
about privacy or its behaviour can't be verified in this code, open an issue and call
it out.

## License

Source-available under the [Dosya Source Available License 1.0](LICENSE):

- **You can** read and audit the code, build and run it with the official
  [dosya.dev](https://dosya.dev) service, and contribute improvements.
- **You can't** redistribute it, use it with any backend other than dosya.dev, or offer
  it as a service.

See [LICENSE](LICENSE) for the exact terms.

## Contributing

Issues and pull requests are welcome. By submitting a contribution you license it to
dosya.dev under the contribution terms in [LICENSE](LICENSE).

## Security

Found a vulnerability? Please report it privately via
[GitHub private vulnerability reporting](../../security/advisories/new) rather than a
public issue.

## The dosya.dev client family

| Repository | What it is | License |
|---|---|---|
| [wordpress](https://github.com/dosya-dev/wordpress) | WordPress plugin - backup, restore, migrate | GPL-2.0-or-later |
| [browser-extensions](https://github.com/dosya-dev/browser-extensions) | Browser extension - Save to dosya for Chrome, Edge, Firefox | Source-available |
| [desktop](https://github.com/dosya-dev/desktop) | Desktop client - sync, upload, manage | Source-available |
| [cli](https://github.com/dosya-dev/cli) | Command-line interface | Source-available |
| [app.dosya.dev](https://github.com/dosya-dev/app.dosya.dev) | Web application | Source-available |
| [shared](https://github.com/dosya-dev/shared) | Shared TypeScript types & utilities | Source-available |
| [dosya-js](https://github.com/dosya-dev/dosya-js) | Official JavaScript SDK | MIT |
| [dosya-java](https://github.com/dosya-dev/dosya-java) | Official Java SDK | MIT |
