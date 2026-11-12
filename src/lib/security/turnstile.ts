import type { Ctx } from "../ctx";
import { AppError } from "../http";

/**
 * Verifies a Turnstile token with Cloudflare. When no secret is configured the
 * check is skipped (local development); production deployments must set
 * TURNSTILE_SECRET_KEY and TURNSTILE_SITE_KEY.
 */
export async function verifyTurnstile(ctx: Ctx, token: string | undefined | null, ip: string) {
  const secret = ctx.env.TURNSTILE_SECRET_KEY;
  if (!secret) return;
  if (!token) throw new AppError(403, "TURNSTILE_FAILED", "Please complete the verification challenge.");
  const body = new URLSearchParams({ secret, response: token });
  if (ip !== "local") body.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean };
  if (!data.success) throw new AppError(403, "TURNSTILE_FAILED", "Verification failed. Please reload the page and try again.");
}
