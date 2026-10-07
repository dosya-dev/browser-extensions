// @vitest-environment node
import { describe, it, expect } from "vitest";
import { dataUrlToBlob } from "./screenshot";
it("decodes a png data url into a png blob", async () => {
  const b = dataUrlToBlob("data:image/png;base64,iVBORw0KGgo=");
  expect(b.type).toBe("image/png"); expect(new Uint8Array(await b.arrayBuffer())).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
});
