import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./db/schema";

export type Db = DrizzleD1Database<typeof schema>;

export interface RuntimeEnv {
  APP_URL: string;
  APP_ENV: string;
  SESSION_SECRET: string;
  CRON_SECRET?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  EMAIL_PROVIDER: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM: string;
  EMAIL_REPLY_TO?: string;
  EMAIL_BATCH_SIZE?: string;
  ADMIN_NOTIFY_EMAIL?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
}

/** Everything a service needs. Tests build one by hand; the app builds it from the Worker bindings. */
export interface Ctx {
  db: Db;
  files: R2Bucket;
  env: RuntimeEnv;
  now: () => number;
}

const DEV_SECRET = "dev-only-secret-not-for-production-use-0000";

export function makeCtx(bindings: { DB: D1Database; FILES: R2Bucket } & Partial<RuntimeEnv>, now: () => number = Date.now): Ctx {
  const appEnv = bindings.APP_ENV ?? "local";
  const secret = bindings.SESSION_SECRET;
  if (!secret && appEnv === "production") {
    throw new Error("SESSION_SECRET is not set. Run: wrangler secret put SESSION_SECRET");
  }
  return {
    db: drizzle(bindings.DB as never, { schema }),
    files: bindings.FILES,
    now,
    env: {
      APP_URL: (bindings.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
      APP_ENV: appEnv,
      SESSION_SECRET: secret ?? DEV_SECRET,
      CRON_SECRET: bindings.CRON_SECRET,
      TURNSTILE_SITE_KEY: bindings.TURNSTILE_SITE_KEY,
      TURNSTILE_SECRET_KEY: bindings.TURNSTILE_SECRET_KEY,
      EMAIL_PROVIDER: bindings.EMAIL_PROVIDER ?? "log",
      EMAIL_API_KEY: bindings.EMAIL_API_KEY,
      EMAIL_FROM: bindings.EMAIL_FROM ?? "CoU AI Hackathon <no-reply@localhost>",
      EMAIL_REPLY_TO: bindings.EMAIL_REPLY_TO,
      EMAIL_BATCH_SIZE: bindings.EMAIL_BATCH_SIZE,
      ADMIN_NOTIFY_EMAIL: bindings.ADMIN_NOTIFY_EMAIL,
      SMTP_HOST: bindings.SMTP_HOST,
      SMTP_PORT: bindings.SMTP_PORT,
      SMTP_USER: bindings.SMTP_USER,
      SMTP_PASSWORD: bindings.SMTP_PASSWORD,
    },
  };
}

export function getCtx(): Ctx {
  const { env } = getCloudflareContext();
  return makeCtx(env as never);
}

/** Runs work after the response is sent, when the platform supports it. */
export function runAfter(promise: Promise<unknown>) {
  const safe = promise.catch((e) => console.error("background task failed", e));
  try {
    getCloudflareContext().ctx.waitUntil(safe);
  } catch {
    /* outside a request (tests): the promise still runs */
  }
}
