import { lt } from "drizzle-orm";
import { getCtx } from "@/lib/ctx";
import { adminSessions, idempotencyKeys, rateLimits, statusOtps } from "@/lib/db/schema";
import { AppError, handle, jsonOk } from "@/lib/http";
import { safeEqual } from "@/lib/ids";
import { cleanupOrphanUploads } from "@/lib/r2/files";
import { drainOutbox } from "@/features/email/outbox";

/** Called every minute by the Worker's scheduled handler. Not reachable without the shared secret. */
export const POST = handle(async (req) => {
  const ctx = getCtx();
  const secret = ctx.env.CRON_SECRET ?? "";
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!secret || !safeEqual(given, secret)) throw new AppError(404, "NOT_FOUND", "Not found.");

  const email = await drainOutbox(ctx);
  const now = ctx.now();
  let cleaned = 0;
  // Housekeeping once an hour is plenty.
  if (new Date(now).getUTCMinutes() === 0) {
    const day = 24 * 60 * 60 * 1000;
    cleaned = await cleanupOrphanUploads(ctx);
    await ctx.db.batch([
      ctx.db.delete(adminSessions).where(lt(adminSessions.expiresAt, now)),
      ctx.db.delete(statusOtps).where(lt(statusOtps.expiresAt, now - day)),
      ctx.db.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, now - day)),
      ctx.db.delete(rateLimits).where(lt(rateLimits.windowStart, Math.floor(now / 1000) - 2 * 60 * 60)),
    ]);
  }
  return jsonOk({ email, cleaned });
});
