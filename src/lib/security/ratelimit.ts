import { sql } from "drizzle-orm";
import type { Ctx } from "../ctx";
import { rateLimits } from "../db/schema";
import { AppError } from "../http";

/** Fixed-window counter stored in D1, so it holds across Worker isolates. */
export async function rateLimit(ctx: Ctx, key: string, limit: number, windowSeconds: number) {
  const nowSec = Math.floor(ctx.now() / 1000);
  const windowStart = nowSec - (nowSec % windowSeconds);
  const rows = await ctx.db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count });
  if ((rows[0]?.count ?? 0) > limit) {
    const retryAfter = windowStart + windowSeconds - nowSec;
    throw new AppError(429, "RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.", undefined, retryAfter);
  }
}
