import { argon2id } from "@noble/hashes/argon2.js";
import { safeEqual } from "../ids";

// OWASP minimum for Argon2id: 19 MiB memory, 2 iterations, 1 lane.
const PARAMS = { m: 19456, t: 2, p: 1 };
const enc = new TextEncoder();

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=+$/, "");
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function hashPassword(password: string): string {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = argon2id(enc.encode(password.normalize("NFKC")), salt, { ...PARAMS, dkLen: 32 });
  return `$argon2id$v=19$m=${PARAMS.m},t=${PARAMS.t},p=${PARAMS.p}$${b64(salt)}$${b64(hash)}`;
}

export function verifyPassword(password: string, phc: string): boolean {
  const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/.exec(phc);
  if (!match) return false;
  const [, m, t, p, salt, expected] = match;
  const hash = argon2id(enc.encode(password.normalize("NFKC")), unb64(salt), { m: +m, t: +t, p: +p, dkLen: 32 });
  return safeEqual(b64(hash), expected);
}

/** Used for unknown emails so a failed login costs the same either way. */
export const DUMMY_HASH = "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const COMMON = new Set(["password1234", "123456789012", "qwertyuiop12", "adminadmin12", "hackathon2026", "comilla12345"]);

export function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (password.length > 200) return "Use at most 200 characters.";
  if (COMMON.has(password.toLowerCase())) return "That password is too common.";
  return null;
}
