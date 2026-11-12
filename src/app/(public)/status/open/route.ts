import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCtx } from "@/lib/ctx";
import { clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/security/ratelimit";
import { verifyStatusSignature } from "@/features/email/outbox";
import { signStatusCookie, STATUS_COOKIE, STATUS_COOKIE_TTL_MS, teamIdForParticipant } from "@/features/status/service";

/** Exchanges the personal link from an email for a short-lived status cookie, then drops the secret from the URL. */
export async function GET(req: Request) {
  const ctx = getCtx();
  const url = new URL(req.url);
  const target = new URL("/status", ctx.env.APP_ENV === "production" ? ctx.env.APP_URL : url.origin);
  const participantId = url.searchParams.get("p") ?? "";
  const signature = url.searchParams.get("s") ?? "";
  try {
    await rateLimit(ctx, `status-open:${clientIp(req)}`, 30, 15 * 60);
    if (participantId && signature && (await verifyStatusSignature(ctx, participantId, signature))) {
      const teamId = await teamIdForParticipant(ctx, participantId);
      if (teamId) {
        (await cookies()).set(STATUS_COOKIE, await signStatusCookie(ctx, teamId), {
          httpOnly: true,
          secure: ctx.env.APP_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: STATUS_COOKIE_TTL_MS / 1000,
        });
        return NextResponse.redirect(target, 303);
      }
    }
  } catch {
    /* fall through to the generic failure */
  }
  target.searchParams.set("link", "invalid");
  return NextResponse.redirect(target, 303);
}
