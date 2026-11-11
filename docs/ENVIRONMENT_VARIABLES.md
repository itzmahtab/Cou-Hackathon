# Environment Variables and Bindings

Planned configuration for the Cloudflare build. The prototype's variables (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`) are removed with it.

Where values live:

| Kind | Local | Preview and production |
| :--- | :--- | :--- |
| Secrets | `.dev.vars` (git-ignored) | `wrangler secret put NAME` |
| Plain variables | `.dev.vars` or `wrangler.jsonc` `vars` | `wrangler.jsonc` `vars` per environment |
| Bindings | `wrangler.jsonc` | `wrangler.jsonc` |

A committed `.dev.vars.example` lists every name with a dummy value.

## Bindings

| Binding | Type | Purpose |
| :--- | :--- | :--- |
| `DB` | D1 database | All relational data |
| `FILES` | R2 bucket (private) | Student IDs, idea documents, payment screenshots |
| `BURST_LIMITER` | Rate Limiting | Short-window burst guard |
| `ASSETS` | Static assets | Next.js static output (managed by OpenNext) |

## Secrets

| Name | Purpose | How to generate |
| :--- | :--- | :--- |
| `SESSION_SECRET` | Derives CSRF tokens and signs status cookies | `openssl rand -base64 48` |
| `TURNSTILE_SECRET_KEY` | Server-side Turnstile verification | Cloudflare dashboard → Turnstile |
| `EMAIL_API_KEY` | Email provider API key, send-only scope | Provider dashboard |

## Plain variables

| Name | Example | Purpose |
| :--- | :--- | :--- |
| `APP_URL` | `https://hackathon.example.edu` | Canonical origin: links in emails, `Origin` check, metadata |
| `APP_ENV` | `production` | `local`, `preview` or `production` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `0x4AAA…` | Turnstile widget; the only security-related value exposed to the browser |
| `EMAIL_PROVIDER` | `brevo` | `brevo`, `resend`, or `memory` (tests and local) |
| `EMAIL_FROM` | `CoU AI Hackathon <no-reply@example.edu>` | Sender; the domain must be verified with the provider |
| `EMAIL_REPLY_TO` | `hackathon@example.edu` | Replies go to the organisers |
| `EMAIL_BATCH_SIZE` | `10` | Emails sent per cron run; sets the send rate |
| `ADMIN_NOTIFY_EMAIL` | `payments@example.edu` | Receives "new payment submitted" notices |

## CI only (GitHub Actions secrets)

| Name | Purpose |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | Deploy the Worker and apply D1 migrations; scoped to this account's Workers, D1 and R2 |
| `CLOUDFLARE_ACCOUNT_ID` | Target account |

## Not environment variables

These change during the event and are stored in `event_settings`, edited in Admin → Settings: phase windows, shortlist dates, fee, bKash and Nagad numbers, file size limits, whether a payment screenshot is required, whether resubmission is allowed, shortlist capacity, contact details, problem domains, organising team.

## Rules

- Nothing secret is ever given a `NEXT_PUBLIC_` prefix.
- `src/lib/env.ts` validates all of the above with Zod at first use and fails with the missing name, so a misconfigured deploy fails on its smoke test and not on a participant.
- Secrets are rotated after the event, and immediately if an administrator with access leaves.
