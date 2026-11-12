const enc = new TextEncoder();

export const uuid = () => crypto.randomUUID();

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

export function randomToken(bytes = 32): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const data = typeof input === "string" ? enc.encode(input) : input;
  return toHex(await crypto.subtle.digest("SHA-256", data as BufferSource));
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

/** Constant-time comparison of two strings of the same alphabet. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Crockford base 32: no I, L, O or U, so IDs survive being read aloud or handwritten.
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const REGISTRATION_ID_PATTERN = /^COU26-[0-9A-HJKMNP-TV-Z]{6}$/;

export function newRegistrationId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return "COU26-" + Array.from(bytes, (b) => CROCKFORD[b % 32]).join("");
}

export function newOtp(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, "0");
}
