import { eq } from "drizzle-orm";
import type { Ctx, RuntimeEnv } from "@/lib/ctx";
import { eventSettings } from "@/lib/db/schema";

/**
 * The SMTP (Gmail App) password can come from the SMTP_PASSWORD Worker secret or be
 * entered by a super admin in Admin -> Settings. The second is stored in D1 encrypted
 * with AES-GCM under a key derived from SESSION_SECRET, and is never sent back to the
 * browser.
 */
const KEY = "smtpPasswordEnc";
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function aesKey(secret: string) {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`smtp-password:${secret}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function saveSmtpPassword(ctx: Ctx, password: string, adminId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(ctx.env.SESSION_SECRET), enc.encode(password)));
  const value = JSON.stringify(`${b64(iv)}.${b64(cipher)}`);
  const now = ctx.now();
  await ctx.db
    .insert(eventSettings)
    .values({ key: KEY, valueJson: value, updatedBy: adminId, updatedAt: now })
    .onConflictDoUpdate({ target: eventSettings.key, set: { valueJson: value, updatedBy: adminId, updatedAt: now } });
}

export async function clearSmtpPassword(ctx: Ctx) {
  await ctx.db.delete(eventSettings).where(eq(eventSettings.key, KEY));
}

async function storedSmtpPassword(ctx: Ctx): Promise<string | null> {
  const row = (await ctx.db.select().from(eventSettings).where(eq(eventSettings.key, KEY)).limit(1))[0];
  if (!row) return null;
  try {
    const [iv, data] = (JSON.parse(row.valueJson) as string).split(".");
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await aesKey(ctx.env.SESSION_SECRET), unb64(data));
    return dec.decode(plain);
  } catch {
    // SESSION_SECRET changed or the value is damaged: treat as not set.
    return null;
  }
}

/** Where the SMTP password comes from, for the admin screens. */
export async function smtpPasswordSource(ctx: Ctx): Promise<"secret" | "settings" | null> {
  if (ctx.env.SMTP_PASSWORD) return "secret";
  return (await storedSmtpPassword(ctx)) ? "settings" : null;
}

/** The runtime email configuration, with the stored SMTP password filled in when needed. */
export async function emailEnv(ctx: Ctx): Promise<RuntimeEnv> {
  if (ctx.env.EMAIL_PROVIDER !== "smtp" || ctx.env.SMTP_PASSWORD) return ctx.env;
  return { ...ctx.env, SMTP_PASSWORD: (await storedSmtpPassword(ctx)) ?? undefined };
}
