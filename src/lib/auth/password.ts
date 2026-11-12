import { argon2id } from "@noble/hashes/argon2.js";
import { safeEqual } from "../ids";

/**
 * Password hashing.
 *
 * New hashes use PBKDF2-SHA256 through Web Crypto, which Cloudflare runs natively and
 * which fits the Workers free plan's CPU budget. 100,000 iterations is the most
 * Workers allows. That is below OWASP's 600,000 for PBKDF2, so the other controls
 * matter: a 12-character minimum, per-IP and per-email sign-in rate limits, and
 * Turnstile. Older Argon2id hashes (pure JavaScript, about 300 ms each) still verify,
 * and are replaced with PBKDF2 the next time that admin signs in.
 */
const ITERATIONS = 100_000;
const enc = new TextEncoder();

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=+$/, "");
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `$pbkdf2-sha256$i=${ITERATIONS}$${b64(salt)}$${b64(await pbkdf2(password, salt, ITERATIONS))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const p = /^\$pbkdf2-sha256\$i=(\d+)\$([^$]+)\$([^$]+)$/.exec(stored);
  if (p) {
    const iterations = Math.min(Number(p[1]), ITERATIONS);
    return safeEqual(b64(await pbkdf2(password, unb64(p[2]), iterations)), p[3]);
  }
  const a = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/.exec(stored);
  if (a) {
    const [, m, t, par, salt, expected] = a;
    const hash = argon2id(enc.encode(password.normalize("NFKC")), unb64(salt), { m: +m, t: +t, p: +par, dkLen: 32 });
    return safeEqual(b64(hash), expected);
  }
  return false;
}

/** True for hashes that should be replaced with the current scheme after a successful sign-in. */
export const needsRehash = (stored: string) => !stored.startsWith(`$pbkdf2-sha256$i=${ITERATIONS}$`);

/** Used for unknown emails so a failed sign-in costs the same either way. */
export const DUMMY_HASH = `$pbkdf2-sha256$i=${ITERATIONS}$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;

const COMMON = new Set(["password1234", "123456789012", "qwertyuiop12", "adminadmin12", "hackathon2026", "comilla12345"]);

export function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (password.length > 200) return "Use at most 200 characters.";
  if (COMMON.has(password.toLowerCase())) return "That password is too common.";
  return null;
}
