/**
 * Putting text on the clipboard when the text is already in hand.
 *
 * Safari grants a click permission to touch the clipboard and treats that
 * permission as spent the moment the handler waits on anything, so a copy that
 * happens after a network round trip is refused with "The request is not
 * allowed by the user agent or the platform in the current context". Chrome is
 * lenient and allows it. Nothing can be done about that from inside the first
 * click; what works is copying text that is already known, from a click of its
 * own, which is what this is for.
 */
export async function copyNow(text: string, doc: Document = document): Promise<boolean> {
  try {
    if (typeof navigator.clipboard?.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* refused; the old way may still be allowed */ }
  return copyViaSelection(text, doc);
}

/**
 * The pre-Clipboard-API way: put the text in a field, select it, let the
 * document copy the selection. Still the most widely permitted route inside an
 * extension popup, and it needs no permission of its own.
 */
export function copyViaSelection(text: string, doc: Document = document): boolean {
  const field = doc.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.setAttribute("aria-hidden", "true");
  field.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0;";
  doc.body.appendChild(field);
  try {
    field.select();
    field.setSelectionRange(0, text.length);
    const run = (doc as Document & { execCommand?: (c: string) => boolean }).execCommand;
    return typeof run === "function" ? run.call(doc, "copy") : false;
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
