import { cookies } from "next/headers";
import { getCtx, runAfter } from "@/lib/ctx";
import { AppError, assertSameOrigin, handle, jsonOk, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/security/ratelimit";
import { drainOutbox } from "@/features/email/outbox";
import { paymentSchema, submitPayment } from "@/features/payments/service";
import { readStatusCookie, STATUS_COOKIE } from "@/features/status/service";

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const ctx = getCtx();
  // The team comes from the verified status cookie, never from the request body.
  const teamId = await readStatusCookie(ctx, (await cookies()).get(STATUS_COOKIE)?.value);
  if (!teamId) throw new AppError(401, "UNAUTHENTICATED", "Your session has expired. Open the link from your email again.");
  await rateLimit(ctx, `payment:${teamId}`, 5, 60 * 60);
  const input = paymentSchema.parse(await readJson(req));
  const result = await submitPayment(ctx, teamId, input);
  runAfter(drainOutbox(ctx, 5));
  return jsonOk({ status: result.status }, 201);
});
