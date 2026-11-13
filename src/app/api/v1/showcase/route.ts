import { getCtx, runAfter } from "@/lib/ctx";
import { assertSameOrigin, clientIp, handle, jsonOk, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/security/ratelimit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { drainOutbox } from "@/features/email/outbox";
import { showcaseSchema } from "@/features/showcase/schema";
import { registerShowcase } from "@/features/showcase/service";

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const ctx = getCtx();
  const ip = clientIp(req);
  // Many students share the campus network, so the per-IP limit is looser than the hackathon's.
  await rateLimit(ctx, `showcase:${ip}`, 20, 15 * 60);
  const input = showcaseSchema.parse(await readJson(req));
  await verifyTurnstile(ctx, input.turnstileToken, ip);
  const result = await registerShowcase(ctx, input, ip);
  runAfter(drainOutbox(ctx, 5));
  return jsonOk(result, 201);
});
