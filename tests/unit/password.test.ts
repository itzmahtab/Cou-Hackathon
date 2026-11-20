import { describe, expect, it } from "vitest";
import { hashPassword, needsRehash, verifyPassword } from "@/lib/auth/password";

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=+$/, "");

async function legacyHash(password: string, iterations: number) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return `$pbkdf2-sha256$i=${iterations}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}

describe("password hashing", () => {
  it("new hashes use 10,000 iterations and verify", async () => {
    const h = await hashPassword("a long enough password");
    expect(h.startsWith("$pbkdf2-sha256$i=10000$")).toBe(true);
    expect(await verifyPassword("a long enough password", h)).toBe(true);
    expect(await verifyPassword("a wrong password here", h)).toBe(false);
    expect(needsRehash(h)).toBe(false);
  });

  it("existing 100,000-iteration hashes still verify and are marked for rehash", async () => {
    const old = await legacyHash("an existing admin password", 100_000);
    expect(await verifyPassword("an existing admin password", old)).toBe(true);
    expect(await verifyPassword("not the password at all", old)).toBe(false);
    expect(needsRehash(old)).toBe(true);
  });

  it("rejects iteration counts Workers cannot run", async () => {
    expect(await verifyPassword("x", "$pbkdf2-sha256$i=200000$AAAA$AAAA")).toBe(false);
  });
});
