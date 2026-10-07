/** WXT copies a runtime content script's `matches` into `host_permissions`, which would make
 *  the store ask for every site at install. The page script is injected on demand under
 *  `activeTab` or an origin the user granted, so the install-time ask is removed while
 *  `optional_host_permissions` keeps `<all_urls>` available to request later. */
export function stripInstallTimeAllUrls(manifest: { host_permissions?: string[] }): void {
  if (!Array.isArray(manifest.host_permissions)) return;
  manifest.host_permissions = manifest.host_permissions.filter((p) => p !== "<all_urls>");
}
