export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, data] = dataUrl.split(",", 2); const type = /^data:([^;]+)/.exec(head)?.[1] ?? "image/png";
  const bin = atob(data); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
