// Worker entry: the OpenNext handler plus a cron handler. The cron calls an
// internal route so all logic stays inside the Next.js app.
/* eslint-disable @typescript-eslint/ban-ts-comment -- .open-next/worker.js only exists after `opennextjs-cloudflare build` */
// @ts-ignore generated at build time
import handler from "./.open-next/worker.js";

const worker = {
  fetch: handler.fetch,
  async scheduled(_event: unknown, env: Record<string, unknown>, ctx: { waitUntil(p: Promise<unknown>): void }) {
    const req = new Request("https://internal.invalid/api/v1/cron", {
      method: "POST",
      headers: { authorization: `Bearer ${String(env.CRON_SECRET ?? "")}` },
    });
    ctx.waitUntil(handler.fetch(req, env, ctx));
  },
};

export default worker;

// @ts-ignore generated at build time
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
