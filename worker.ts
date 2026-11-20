// Worker entry: the OpenNext handler plus a cron handler. The cron calls an
// internal route so all logic stays inside the Next.js app.
/* eslint-disable @typescript-eslint/ban-ts-comment -- .open-next/worker.js only exists after `opennextjs-cloudflare build` */
// @ts-ignore generated at build time
import handler from "./.open-next/worker.js";

type Ctx = { waitUntil(p: Promise<unknown>): void };

// Every page rendered by Next.js costs ~25-40 ms of CPU, well over the Workers
// Free plan's 10 ms per request, so Cloudflare kills some requests (error 1102).
// Pages that look the same for every visitor are kept in the edge cache and
// served stale-while-revalidate: a visitor always gets the stored copy at once,
// and a copy older than PAGE_FRESH is re-rendered after the response is sent.
// If that background render is killed, the visitor already has their page.
const PAGE_FRESH = 60; // seconds: settings edits show on public pages within about a minute
const PAGE_KEEP = 7 * 86400; // how long a stale copy may still be served while it refreshes
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
// Pages that differ only for a visitor holding one of these cookies; everyone else gets the cached copy.
const COOKIE_PAGES: Record<string, string[]> = {
  "/status": ["cou_status"],
  "/admin/login": ["__Host-cou_admin", "cou_admin"],
};
const CACHED_FILES = new Set(["/robots.txt", "/sitemap.xml", "/icon.png", "/opengraph-image.png", "/twitter-image.png"]);
// The Next.js client router asks for different payloads (full HTML, RSC, prefetch) on the same URL.
const VARY_HEADERS = ["rsc", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-url"];
const NO_STORE = "private, no-cache, no-store, max-age=0, must-revalidate";
const STORED_AT = "X-Edge-Stored-At";

function hasCookie(request: Request, names: string[]): boolean {
  const header = request.headers.get("cookie");
  if (!header) return false;
  return header.split(";").some((part) => names.includes(part.split("=")[0].trim()));
}

async function cacheKey(request: Request, url: URL, env: unknown): Promise<Request> {
  const key = new URL(url);
  // A new deployment has new script and asset names, so it must never get an older copy.
  key.searchParams.set("__ver", (env as { CF_VERSION_METADATA?: { id?: string } }).CF_VERSION_METADATA?.id ?? "dev");
  const vary = VARY_HEADERS.map((h) => `${h}:${request.headers.get(h) ?? ""}`).join("\n");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(vary));
  key.searchParams.set("__edge", [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""));
  return new Request(key.toString(), { method: "GET" });
}

/** Renders through Next.js and stores the result. Returns the response for the visitor. */
async function renderAndStore(cache: Cache, key: Request, request: Request, keep: number, env: unknown, ctx: Ctx): Promise<Response> {
  const res: Response = await handler.fetch(request, env, ctx);
  if (res.status !== 200 || res.headers.has("set-cookie")) return res;
  const stored = new Response(res.clone().body, res);
  stored.headers.set("Cache-Control", `public, max-age=${keep}`);
  stored.headers.set(STORED_AT, String(Date.now()));
  stored.headers.delete("Vary"); // the key already covers what the response varies on
  ctx.waitUntil(cache.put(key, stored).catch(() => undefined));
  return res;
}

async function cachedFetch(request: Request, url: URL, isPage: boolean, env: unknown, ctx: Ctx): Promise<Response> {
  // `caches.default` is Cloudflare's per-datacentre cache (a no-op on workers.dev).
  const cache = (caches as unknown as { default: Cache }).default;
  const key = await cacheKey(request, url, env);
  const keep = isPage ? PAGE_KEEP : FILE_TTL;
  const hit = await cache.match(key);
  if (hit) {
    const res = new Response(hit.body, hit);
    const age = (Date.now() - Number(hit.headers.get(STORED_AT) ?? 0)) / 1000;
    const stale = isPage && age > PAGE_FRESH;
    if (stale) {
      const refresh = new Request(request.url, { method: "GET", headers: request.headers });
      // Wait until the stored copy has gone out, then re-render in the background.
      ctx.waitUntil(
        new Promise((r) => setTimeout(r, 1000))
          .then(() => renderAndStore(cache, key, refresh, keep, env, ctx))
          .then((r) => r.body?.cancel())
          .catch(() => undefined),
      );
    }
    // Browsers must not keep pages, or they would miss setting changes.
    if (isPage) res.headers.set("Cache-Control", NO_STORE);
    res.headers.delete(STORED_AT);
    res.headers.set("X-Edge-Cache", stale ? "STALE" : "HIT");
    return res;
  }
  const res = await renderAndStore(cache, key, request, keep, env, ctx);
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
      const cookies = COOKIE_PAGES[url.pathname];
      if (CACHED_PAGES.has(url.pathname) || (cookies && !hasCookie(request, cookies))) return cachedFetch(request, url, true, env, ctx);
      if (CACHED_FILES.has(url.pathname)) return cachedFetch(request, url, false, env, ctx);
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
