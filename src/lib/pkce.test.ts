import { describe, it, expect } from "vitest";
import { createPkce, randomBase64Url, sha256Hex } from "./pkce";

describe("pkce", () => {
  it("makes base64url strings of the expected length", () => {
    expect(randomBase64Url(32)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomBase64Url(48)).toMatch(/^[A-Za-z0-9_-]{64}$/);
  });
  it("verifier 64 chars, challenge is base64url(sha256(verifier)) of 43 chars, state 32 chars", async () => {
    const p = await createPkce();
    expect(p.verifier).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(p.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(p.state).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(p.verifier));
    const expected = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(p.challenge).toBe(expected);
  });
  it("sha256Hex matches a known vector", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
