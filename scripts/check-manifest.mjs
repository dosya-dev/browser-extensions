import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WANT_HOST = ["https://api.dosya.dev/*", "https://app.dosya.dev/*"];
const WANT_OPTIONAL = ["<all_urls>"];
const STORE_ZIP = process.env.EXTENSION_STORE_ZIP === "1";
const WANT_FIREFOX_MIN = "140.0";
const WANT_DATA_COLLECTION = ["authenticationInfo", "websiteContent"];
const targets = ["chrome-mv3", "firefox-mv3"];
const problems = [];
let checked = 0;

for (const target of targets) {
  const path = join(root, ".output", target, "manifest.json");
  if (!existsSync(path)) continue;
  checked++;
  const m = JSON.parse(readFileSync(path, "utf8"));
  const host = JSON.stringify(m.host_permissions ?? null);
  const optional = JSON.stringify(m.optional_host_permissions ?? null);
  if (host !== JSON.stringify(WANT_HOST)) {
    problems.push(`${target}: host_permissions is ${host}, expected ${JSON.stringify(WANT_HOST)}`);
  }
  if (optional !== JSON.stringify(WANT_OPTIONAL)) {
    problems.push(`${target}: optional_host_permissions is ${optional}, expected ${JSON.stringify(WANT_OPTIONAL)}`);
  }
  if (target === "chrome-mv3" && STORE_ZIP && "key" in m) {
    // The Chrome Web Store rejects a package whose manifest carries "key".
    problems.push(`${target}: "key" is present in a store upload build; the store refuses it`);
  }
  if (target === "firefox-mv3") {
    const gecko = m.browser_specific_settings?.gecko ?? {};
    if (gecko.strict_min_version !== WANT_FIREFOX_MIN) {
      problems.push(`${target}: strict_min_version is ${JSON.stringify(gecko.strict_min_version)}, expected ${JSON.stringify(WANT_FIREFOX_MIN)}`);
    }
    const dcp = JSON.stringify(gecko.data_collection_permissions?.required ?? null);
    if (dcp !== JSON.stringify(WANT_DATA_COLLECTION)) {
      problems.push(`${target}: data_collection_permissions.required is ${dcp}, expected ${JSON.stringify(WANT_DATA_COLLECTION)}`);
    }
    if ("key" in m) problems.push(`${target}: Chromium "key" leaked into the Firefox manifest`);
  }
}

if (!checked) {
  console.error("check-manifest: no built manifest found under .output; build first");
  process.exit(1);
}
if (problems.length) {
  console.error("check-manifest: a built manifest asks for the wrong hosts");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`check-manifest: ${checked} manifest(s) ask only for the two dosya origins at install, with the Firefox store fields${STORE_ZIP ? " and no Chromium key" : ""}`);
