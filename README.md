# CoU AI Hackathon 2026

> Six Hours. One Vision. Infinite Possibilities.

The hackathon management platform for **CoU AI Hackathon 2026**, the flagship competition of CoU Technova 2026, presented by the Faculty of Engineering, Comilla University. Title sponsor: Gigabyte AORUS. Powered by: IT Palace.

| | |
| :--- | :--- |
| Event | 24 November 2026, on-site at Comilla University, 6 hours |
| Prize pool | BDT 25,000 (10,000 / 8,000 / 7,000) |
| Phase 1 | 12–18 November: free team and idea registration (teams of 1–3) |
| Phase 2 | 21–23 November: top 30 teams confirm with BDT 1,350 per team |

## Current state

**Planning is complete and awaiting approval. The platform described in `docs/` has not been built yet.**

The code currently in `app/`, `components/`, `lib/` and `db/` is an earlier prototype built on PostgreSQL and Supabase with different event rules (3–4 members, a BDT 1,000 fee at registration, team logins, an online round). The plan replaces it; see `docs/ARCHITECTURE.md` section 2. The files `ADMIN_MANUAL.md`, `FACULTY_HANDOVER_MANUAL.md`, `HOSTING.md`, `LOCAL_SETUP.md` and `ASSUMPTIONS.md` describe that prototype, not the planned platform.

## Planned platform

- Public site: event information, schedule, prizes, rules, FAQ, leaderboard.
- Two-phase registration: idea submission with documents, then manual bKash / Nagad payment verification for shortlisted teams.
- Admin panel with five roles: registrations, idea scoring, top-30 shortlist, payments, check-in, results, email log, activity log.
- Transactional email with retries and duplicate-send prevention.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Motion, Lenis, Drizzle ORM, Cloudflare Workers (OpenNext), D1, R2, Turnstile.

## Documents

| Document | Contents |
| :--- | :--- |
| [PRD](docs/PRD.md) | Requirements, scope, and the defaults chosen where the brief was ambiguous |
| [Architecture](docs/ARCHITECTURE.md) | System design, Cloudflare limits and workarounds, costs, folder structure |
| [App flow](docs/APP_FLOW.md) | Status lifecycle and the four main workflows |
| [Database schema](docs/DATABASE_SCHEMA.md) | Tables, constraints, atomic operations, retention |
| [API](docs/API_DOCUMENTATION.md) | Endpoint contracts and the role–permission matrix |
| [Security](docs/SECURITY.md) | Controls, and the gaps accepted for this release |
| [Design system](docs/DESIGN_SYSTEM.md) | Tokens, type, components, motion, accessibility |
| [Development phases](docs/DEVELOPMENT_PHASES.md) | Build order against the event calendar, and what is needed from the organisers |
| [Deployment](docs/DEPLOYMENT.md) | Cloudflare setup, CI/CD, operations |
| [Testing](docs/TESTING.md) | Unit, integration, end-to-end and security test plan |
| [Environment variables](docs/ENVIRONMENT_VARIABLES.md) | Bindings, secrets and configuration |

## Running the existing prototype

Until Phase 2 replaces it, the repository still runs as before; see `LOCAL_SETUP.md`.

```bash
pnpm install
```
```bash
pnpm dev
```

Read `AGENTS.md` before changing code: this Next.js version differs from older releases, and its bundled documentation under `node_modules/next/dist/docs/` is the reference.
