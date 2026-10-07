/** The code and state as the API put them in the callback URL; the page's data attributes are a
 *  fallback. The done page is a client-rendered app, so the element may not exist yet when the
 *  content script runs; reading the URL is what makes the tab flow work in Safari. */
export function readCallback(search: string, doc: Pick<Document, "getElementById">): { code: string; state: string } | null {
  const q = new URLSearchParams(search);
  const fromUrl = { code: q.get("code") ?? "", state: q.get("state") ?? "" };
  if (fromUrl.code && fromUrl.state) return fromUrl;
  const el = doc.getElementById("dosya-extension-callback");
  const fromDom = { code: el?.getAttribute("data-code") ?? "", state: el?.getAttribute("data-state") ?? "" };
  return fromDom.code && fromDom.state ? fromDom : null;
}
