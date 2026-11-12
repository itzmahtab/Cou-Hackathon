import { getCtx, runAfter } from "@/lib/ctx";
import { assertSameOrigin, clientIp, handle, jsonOk, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/security/ratelimit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { drainOutbox } from "@/features/email/outbox";
import { registrationSchema } from "@/features/registration/schema";
import { registerTeam } from "@/features/registration/service";

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const ctx = getCtx();
  const ip = clientIp(req);
  await rateLimit(ctx, `register:${ip}`, 5, 15 * 60);
  const input = registrationSchema.parse(await readJson(req));
  await verifyTurnstile(ctx, input.turnstileToken, ip);
  const result = await registerTeam(ctx, input, ip);
  // Send the confirmation straight away; the cron drain is the safety net.
  runAfter(drainOutbox(ctx, 5));
  return jsonOk(result, 201);
});
