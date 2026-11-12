import { cookies } from "next/headers";
import { z } from "zod";
import { getCtx } from "@/lib/ctx";
import { assertSameOrigin, clientIp, handle, jsonOk, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/security/ratelimit";
import { signStatusCookie, STATUS_COOKIE, STATUS_COOKIE_TTL_MS, verifyStatusOtp } from "@/features/status/service";

const schema = z.object({ registrationId: z.string().min(6).max(20), email: z.string().email().max(160), code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code.") });

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const ctx = getCtx();
  await rateLimit(ctx, `otp-verify:${clientIp(req)}`, 10, 15 * 60);
  const input = schema.parse(await readJson(req));
  const teamId = await verifyStatusOtp(ctx, input.registrationId, input.email, input.code);
  (await cookies()).set(STATUS_COOKIE, await signStatusCookie(ctx, teamId), {
    httpOnly: true,
    secure: ctx.env.APP_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATUS_COOKIE_TTL_MS / 1000,
  });
  return jsonOk({ verified: true });
});
