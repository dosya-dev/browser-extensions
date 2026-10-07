import { MAX_SELECTION_CHARS } from "../config";
export function truncateSelection(text: string, max = MAX_SELECTION_CHARS): string { return text.length > max ? text.slice(0, max) : text; }
export function selectionText(p: { title: string; url: string; text: string }): string { return `Title: ${p.title}\nSource: ${p.url}\n\n${p.text}`; }
