// Worker entry: the OpenNext handler plus a cron handler. The cron calls an
// internal route so all logic stays inside the Next.js app.
/* eslint-disable @typescript-eslint/ban-ts-comment -- .open-next/worker.js only exists after `opennextjs-cloudflare build` */
// @ts-ignore generated at build time
import handler from "./.open-next/worker.js";

type Ctx = { waitUntil(p: Promise<unknown>): void };

// Every page rendered by Next.js costs ~25-40 ms of CPU, well over the Workers
// Free plan's 10 ms per request, so Cloudflare kills some requests (error 1102).
// Public pages look the same for every visitor, so the rendered output is kept
// in the edge cache for a short time and repeat views never start Next.js.
// Admin, status and API routes are never cached.
const PAGE_TTL = 60; // seconds: settings edits show on public pages within a minute
const FILE_TTL = 86400;
const CACHED_PAGES = new Set([
  "/",
  "/about",
  "/challenges",
  "/contact",
  "/faq",
  "/leaderboard",
  "/payment",
  "/privacy",
  "/prizes",
  "/register",
  "/rules",
  "/schedule",
  "/showcase",
  "/showcase/register",
  "/terms",
]);
const CACHED_FILES = new Set(["/robots.txt", "/sitemap.xml", "/icon.png", "/opengraph-image.png", "/twitter-image.png"]);
// The Next.js client router asks for different payloads (full HTML, RSC, prefetch) on the same URL.
const VARY_HEADERS = ["rsc", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-url"];
const NO_STORE = "private, no-cache, no-store, max-age=0, must-revalidate";

async function cacheKey(request: Request, url: URL): Promise<Request> {
  const key = new URL(url);
  const vary = VARY_HEADERS.map((h) => `${h}:${request.headers.get(h) ?? ""}`).join("\n");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(vary));
  key.searchParams.set("__edge", [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""));
  return new Request(key.toString(), { method: "GET" });
}

async function cachedFetch(request: Request, url: URL, ttl: number, env: unknown, ctx: Ctx): Promise<Response> {
  // `caches.default` is Cloudflare's per-datacentre cache (a no-op on workers.dev).
  const cache = (caches as unknown as { default: Cache }).default;
  const key = await cacheKey(request, url);
  const hit = await cache.match(key);
  if (hit) {
    const res = new Response(hit.body, hit);
    // Browsers must not keep pages, or they would miss setting changes.
    if (ttl === PAGE_TTL) res.headers.set("Cache-Control", NO_STORE);
    res.headers.set("X-Edge-Cache", "HIT");
    return res;
  }
  const res: Response = await handler.fetch(request, env, ctx);
  if (res.status !== 200 || res.headers.has("set-cookie")) return res;
  const stored = new Response(res.clone().body, res);
  stored.headers.set("Cache-Control", `public, max-age=${ttl}`);
  stored.headers.delete("Vary"); // the key already covers what the response varies on
  ctx.waitUntil(cache.put(key, stored).catch(() => undefined));
  const out = new Response(res.body, res);
  out.headers.set("X-Edge-Cache", "MISS");
  return out;
}

const worker = {
  async fetch(request: Request, env: unknown, ctx: Ctx) {
    // One canonical address: www.coutechnova.xyz -> coutechnova.xyz.
    const url = new URL(request.url);
    if (url.hostname === "www.coutechnova.xyz") {
      url.hostname = "coutechnova.xyz";
      return Response.redirect(url.toString(), 301);
    }
    if (request.method === "GET" && !request.headers.has("next-action")) {
      if (CACHED_PAGES.has(url.pathname)) return cachedFetch(request, url, PAGE_TTL, env, ctx);
      if (CACHED_FILES.has(url.pathname)) return cachedFetch(request, url, FILE_TTL, env, ctx);
    }
    return handler.fetch(request, env, ctx);
  },
  async scheduled(_event: unknown, env: Record<string, unknown>, ctx: Ctx) {
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
