# Architecture

Status: Phase 1 design. Items marked **Verify in Phase 2** are assumptions I have not yet proven on this codebase.

## 1. Overview

```
Browser
  │  HTTPS
  ▼
Cloudflare edge ── DNS, CDN, WAF, Turnstile verification endpoint
  │
  ▼
Worker: Next.js 16 App Router, built with @opennextjs/cloudflare
  ├── Server Components ........ public pages, admin pages
  ├── Route handlers /api/v1 ... forms, uploads, admin mutations, file delivery
  ├── scheduled() handler ...... email outbox drain, orphan-upload cleanup
  │
  ├── D1  (binding DB) ......... all relational data, via Drizzle
  ├── R2  (binding FILES) ...... private bucket: student IDs, idea docs, payment screenshots
  ├── Rate Limiting binding .... short-window burst limits
  └── fetch → email provider HTTP API
```

One Worker, one D1 database, one private R2 bucket. No separate API service, no Redis, no queue product.

## 2. What happens to the existing code

The repository holds a prototype built on `pg`, Supabase Storage, `jsonwebtoken` and `bcryptjs`, with a 2,100-line client-side admin page and a React context that mirrors server state. Its rules (3–4 members, fee at registration, team logins, an online round) differ from this brief, and its data layer cannot run on D1.

Decision: **rebuild under `src/`**, then delete the old `app/`, `components/`, `context/`, `hooks/`, `lib/`, `utils/`, `types/`, `db/`, `proxy.ts`, `instrumentation*.ts` and the superseded manuals in the same change that introduces the replacement.

Carried over:
- `public/sponsors/*` and `public/event-logo-horizontal.png` (the duplicate top-level `sponsors/` directory is removed).
- `components/common/NeuralCanvas.tsx` as the starting point for the hero visual.
- `components/common/QRCode.tsx` for check-in passes.
- Landing copy, the magic-byte image sniffing in `lib/storage.ts`, and `formatDhakaTime`.

The old code stays reachable in git history at commit `6dfe034`.

## 3. Stack

| Concern | Choice | Note |
| :--- | :--- | :--- |
| Framework | Next.js 16.4.6, React 19, TypeScript strict | Already pinned in the repo. `AGENTS.md` warns of breaking changes; the bundled docs in `node_modules/next/dist/docs/` are the reference. |
| Adapter | `@opennextjs/cloudflare` 1.20.x | Its peer range `>=16.4.5` covers this Next.js version. |
| Styling | Tailwind CSS 4, shadcn/ui | |
| Motion | `motion` for component animation, Lenis for scroll | GSAP is added only if a specific scroll-linked sequence needs it; running two animation engines by default costs bundle size for nothing. |
| Forms | React Hook Form + Zod | The same Zod schemas validate on the server. |
| Client data | TanStack Query in the admin panel only | Public pages are Server Components and need none. |
| ORM | Drizzle (`drizzle-orm/d1`), `drizzle-kit` migrations | |
| Email | HTTP API provider behind an interface | Section 6. |
| Tests | Vitest, `@cloudflare/vitest-pool-workers`, Playwright | |
| Package manager | pnpm | Already configured. |

## 4. Cloudflare platform limits and how the design answers them

These are the points where a Worker is not a Node.js server.

| Limit | Consequence | Design |
| :--- | :--- | :--- |
| No persistent process, no shared memory between requests | In-memory rate limits, caches and job timers do not work | Rate-limit counters and the email outbox live in D1; periodic work runs from a Cron Trigger. |
| D1 has no interactive transactions | `BEGIN … COMMIT` across awaits is unavailable | Multi-row writes use `db.batch([...])`, which D1 applies atomically. Invariants (unique email, unique transaction ID, one verified payment per team) are enforced by unique indexes, so a race loses at the database, not in application code. |
| D1 is single-writer SQLite | Fine at this scale (hundreds of teams) | Indexed queries, pagination. |
| Free plan: 10 ms CPU per request and a 3 MiB compressed Worker | Password hashing and a full Next.js server bundle may not fit | **Verify in Phase 2.** Measured on the first deploy. If either limit is exceeded, the Workers Paid plan (USD 5 per month) is required. I expect it will be. |
| Raw TCP SMTP is not a natural fit | NodeMailer's SMTP transport depends on Node socket behaviour that Workers only partly emulate | Email goes out over HTTPS to a provider API. NodeMailer is not used. |
| R2 presigned URLs need S3 API credentials, and a presigned `PUT` cannot inspect content | The "browser uploads straight to R2" flow cannot verify magic bytes before the object exists | Section 5. |
| Rate Limiting binding supports only 10 s or 60 s periods | "5 per 15 minutes" cannot be expressed | Binding for bursts; D1 fixed-window counters for the long windows. |
| `proxy.ts` (Next.js 16's renamed middleware) and `cacheComponents` on OpenNext | Support may be incomplete | **Verify in Phase 2.** The design does not depend on either: authorisation is checked in the admin layout and in every route handler, never only at the edge. |
| `next/image` optimisation | Needs Cloudflare Images (limited free quota) | Brand images are pre-sized static assets; no runtime optimiser. |

## 5. File uploads

The brief prefers: authorise → short-lived upload URL → browser uploads to R2 → server checks metadata. I am proposing a variation and want it approved explicitly.

**Proposed: upload through the Worker to the R2 binding.**

1. The browser posts one file to `POST /api/v1/uploads` with a Turnstile token and an upload-session ID (a random value created when the form opens).
2. The Worker enforces the size limit from `Content-Length` and again while reading, reads the first bytes, and identifies the type from magic bytes (JPEG, PNG, WebP, `%PDF-`, or a ZIP container holding `[Content_Types].xml` and `word/` for DOCX). The client's filename and MIME type are ignored for validation.
3. It writes to R2 under a random key (`student-id/<uuid>.jpg`, `ideas/<uuid>.pdf`, `payments/<uuid>.png`) and inserts a `files` row with status `PENDING`, bound to the upload session.
4. Registration submission references file IDs. The server accepts only `PENDING` files from the same upload session and flips them to `ATTACHED` in the same batch that creates the team.
5. A Cron Trigger deletes `PENDING` files older than 24 hours, object first, then row.

Why not presigned PUT: files here are at most 10 MB, far below the Worker request limit; this path validates content before anything is stored, needs no long-lived S3 credentials in the Worker, and keeps the bucket reachable only through the binding. The cost is that upload bytes pass through the Worker. If you prefer the presigned flow, it is a contained change to this one endpoint.

**Downloads** are always `GET /api/v1/admin/files/:id`, which checks the admin session and role, streams from R2 with `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` and a restrictive CSP, and writes an activity-log entry. The bucket has no public domain. Images are displayed in the admin panel through the same endpoint with `inline` disposition for image types only.

## 6. Email

```
domain event ──► email_outbox row (status QUEUED, unique dedupe_key)
                       │
   ctx.waitUntil ──────┤  best-effort immediate send
   Cron every minute ──┘  drains QUEUED and retryable FAILED, N per run
                       ▼
               EmailProvider.send()  ──►  SENT | FAILED (attempts++, next_attempt_at)
```

- `dedupe_key` is `<template>:<team_id>:<participant_id>:<generation>`. A unique index makes a second automatic send impossible. An admin resend increments the generation and is logged.
- Retries back off 1, 5, 30, 120 minutes, then stop at `DEAD` and surface in the admin panel.
- The cron batch size is the rate control; it is set from the provider's limit.
- Templates are typed functions in `src/features/email/templates/`, each returning `{ subject, html, text }`. They are versioned with the code, which is why there is no `email_templates` table.
- Provider is an interface with two adapters to choose from at deploy time.

| Provider | Free allowance (check current pricing before relying on it) | Fit |
| :--- | :--- | :--- |
| Brevo | about 300 emails per day | Enough for registration confirmations spread over a week. Shortlist and results days may exceed it; the outbox simply takes a second day unless a paid month is bought. |
| Resend | about 100 per day, 3,000 per month | Too tight for a bulk day without paying. |

Rough volume: 150 teams × 2.3 members ≈ 350 recipients. Confirmation, shortlist result, and final results are each one email per recipient, so three bulk moments of about 350. Either pay for one month of a provider, or accept that a 350-recipient notification takes two days on a free tier. **This is a decision for the organisers.** A verified sending domain (SPF, DKIM) is required either way.

## 7. Authentication

- Admin only. Opaque 256-bit session token in an `HttpOnly; Secure; SameSite=Lax; Path=/` cookie with the `__Host-` prefix. Only the SHA-256 of the token is stored in `admin_sessions`.
- Idle timeout 2 hours, absolute lifetime 12 hours. Logout deletes the row.
- No JWTs: a database session can be revoked immediately, which matters more here than saving one indexed read.
- Password hashing: see `SECURITY.md` section 3 (Argon2id target, with a platform caveat).
- Authorisation is a single `requirePermission(permission)` helper called at the top of every admin route handler and admin page. Roles map to permissions in one file.

## 8. Rendering and caching

- Public pages are Server Components. Settings, schedule, announcements and the published leaderboard are read from D1 and cached with tag-based revalidation; admin writes revalidate the tag.
- The leaderboard query selects only public columns from published results; there is no code path that serialises a full result row to a public response.
- Client Components: the registration wizard, the payment form, the status page, the countdown, the hero canvas, Lenis, and the interactive parts of the admin panel. The hero canvas and confetti are dynamically imported.

## 9. Cost summary

| Service | Free tier sufficient? |
| :--- | :--- |
| Workers | Probably **not**: expect USD 5 per month (Workers Paid) for CPU time and bundle size. Confirmed in Phase 2. |
| D1 | Yes |
| R2 | Yes (worst case about 3 GB against a 10 GB allowance) |
| Turnstile | Yes |
| Cron Triggers | Yes |
| WAF rate-limiting rule | One rule on the free plan; used as a coarse flood guard |
| Email | Free tier works with slower bulk sends; otherwise one paid month |
| Domain | Not free unless a `cou.ac.bd` subdomain is delegated |
| GitHub Actions | Yes |

## 10. Folder structure

```
src/
  app/
    (public)/            home, about, challenges, rules, register, status,
                         payment, schedule, prizes, faq, contact, leaderboard,
                         privacy, terms
    (auth)/admin/login/
    admin/               dashboard, registrations, reviews, shortlist, payments,
                         participants, emails, event, results, logs, settings
    api/v1/              route handlers
  components/
    ui/                  shadcn primitives
    layout/  sections/  forms/  admin/
  features/
    registration/  submissions/  shortlist/  payments/  attendance/
    leaderboard/   authentication/  email/
      each: schema.ts (Zod), service.ts (business rules), queries.ts
  lib/
    db/        schema.ts, client.ts
    r2/        file service, magic-byte sniffing
    auth/      sessions, password hashing, permissions
    security/  rate limit, turnstile, origin check, headers
    env.ts     typed access to bindings and secrets
  config/      event constants, navigation
  types/
drizzle/migrations/
scripts/       create-admin.ts, seed.ts
tests/         unit/  integration/  e2e/
public/
wrangler.jsonc
open-next.config.ts
```

Business rules live in `features/*/service.ts` and take a database handle as an argument, so they are tested without HTTP.
