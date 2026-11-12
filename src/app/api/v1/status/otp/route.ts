import { z } from "zod";
import { getCtx, runAfter } from "@/lib/ctx";
import { assertSameOrigin, clientIp, handle, jsonOk, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/security/ratelimit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { drainOutbox } from "@/features/email/outbox";
import { requestStatusOtp } from "@/features/status/service";

const schema = z.object({ registrationId: z.string().min(6).max(20), email: z.string().email().max(160), turnstileToken: z.string().max(4096).optional() });

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const ctx = getCtx();
  const ip = clientIp(req);
  const input = schema.parse(await readJson(req));
  await rateLimit(ctx, `otp-ip:${ip}`, 10, 60 * 60);
  await rateLimit(ctx, `otp-reg:${input.registrationId.toUpperCase()}`, 3, 15 * 60);
  await verifyTurnstile(ctx, input.turnstileToken, ip);
  await requestStatusOtp(ctx, input.registrationId, input.email);
  runAfter(drainOutbox(ctx, 3));
  // Identical whether or not the pair matched.
  return jsonOk({ sent: true });
});
