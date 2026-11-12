# CoU AI Hackathon 2026

> Five Hours. One Vision. Infinite Possibilities.

The hackathon management platform for **CoU AI Hackathon 2026**, the flagship competition of CoU Technova 2026, presented by the Faculty of Engineering, Comilla University. Title sponsor: Gigabyte AORUS. Powered by: IT Palace.

| | |
| :--- | :--- |
| Event | 24 November 2026, on-site at Comilla University, 5 hours |
| Prize pool | BDT 25,000 (10,000 / 8,000 / 7,000) |
| Phase 1 | 12–18 November: free team and idea registration (teams of 1–3) |
| Phase 2 | 21–23 November: top 30 teams confirm with BDT 1,350 per team |
| Production URL | https://coutechnova.xyz (also https://cou-hackathon.cou-hackathon.workers.dev) |

## What is built

**Public site:** home, about, challenges, rules, registration, registration status, payment instructions, schedule, prizes, FAQ, contact, leaderboard, privacy, terms. Dark, animated design with Lenis smooth scrolling, a live countdown and a reduced-motion fallback for every effect.

**Registration:** a four-step wizard plus a confirmation screen. It covers team, participants, idea and review. Each student ID image and the idea document are uploaded and checked by content, not by name. Drafts survive a refresh, and a double submit creates one team. Every member gets a confirmation email with a personal status link.

**Status and payment:** participants open their status through the emailed link or a one-time code. Shortlisted teams submit their bKash or Nagad Send Money details there, and an organiser verifies them by hand.

**Admin panel** (`/admin`) has five roles:
- Dashboard.
- Registrations, with search, filters, ID-card viewing, participant correction and CSV export.
- Idea scoring and side-by-side comparison.
- Top-30 shortlist, with an audited override and one-shot finalisation that emails everyone.
- Payment verification.
- Approved participants.
- Event-day check-in, schedule and announcements.
- Final results, with preview, publish and unpublish.
- Email delivery log with resend.
- Activity log.
- Settings, admin accounts and the data-retention purge.

**Theme:** dark by default with a light mode toggle; the choice is remembered.

**Platform:** Next.js 16 on Cloudflare Workers (OpenNext), D1 through Drizzle, a private R2 bucket, Argon2id passwords with database sessions, D1-backed rate limits, optional Turnstile, and an email outbox (Gmail SMTP through Nodemailer) with retries, drained every minute by a cron trigger.

## Before the event goes live

| Item | Status | Where |
| :--- | :--- | :--- |
| `CLOUDFLARE_API_TOKEN` GitHub secret | Needed for automatic deploys | Repository → Settings → Secrets → Actions |
| First super admin | Create once deployed | `pnpm admin:create -- --remote` |
| Gmail App Password (`SMTP_PASSWORD`) | Needed: emails queue until it is set | `docs/DEPLOYMENT.md` § 9 |
| Turnstile | Optional but recommended | `docs/DEPLOYMENT.md` § Turnstile |
| bKash and Nagad numbers, contacts, organisers | Enter in Admin → Settings | |

## Development

```bash
pnpm install
```
```bash
cp .dev.vars.example .dev.vars
```
```bash
pnpm db:migrate:local
```
```bash
pnpm admin:create -- --local
```
```bash
pnpm dev
```

Read `AGENTS.md` before changing code: this Next.js version differs from older releases, and its bundled documentation under `node_modules/next/dist/docs/` is the reference.

## Tests

```bash
pnpm typecheck && pnpm lint && pnpm test
```

`pnpm test` runs 66 unit and integration tests against a real local D1 and R2. The browser workflows in `tests/e2e/` are described in `docs/TESTING.md`.

## Documents

| Document | Contents |
| :--- | :--- |
| [PRD](docs/PRD.md) | Requirements, scope, and the defaults chosen where the brief was ambiguous |
| [Architecture](docs/ARCHITECTURE.md) | System design, Cloudflare limits and workarounds, costs |
| [App flow](docs/APP_FLOW.md) | Status lifecycle and the main workflows |
| [Database schema](docs/DATABASE_SCHEMA.md) | Tables, constraints, atomic operations, retention |
| [API](docs/API_DOCUMENTATION.md) | Endpoint contracts and the role–permission matrix |
| [Security](docs/SECURITY.md) | Controls, and the gaps accepted for this release |
| [Design system](docs/DESIGN_SYSTEM.md) | Tokens, type, components, motion, accessibility |
| [Development phases](docs/DEVELOPMENT_PHASES.md) | What was built, and what remains |
| [Deployment](docs/DEPLOYMENT.md) | Cloudflare setup, CI/CD, operations |
| [Testing](docs/TESTING.md) | What is tested and how to run it |
| [Environment variables](docs/ENVIRONMENT_VARIABLES.md) | Bindings, secrets and configuration |
