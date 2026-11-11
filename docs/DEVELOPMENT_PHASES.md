# Development Phases

## Status

| Phase | State |
| :--- | :--- |
| 1 Planning | **Complete, awaiting approval** (this document set) |
| 2–10 | Not started |

No application code has been written or changed in Phase 1.

## The calendar problem

Written on 11 November 2026.

| Date | What must be live |
| :--- | :--- |
| 12 Nov | Phase 1 registration opens |
| 19 Nov | Reviewers start scoring |
| 20 Nov | Shortlist finalised, emails sent |
| 21 Nov | Payment form opens |
| 23 Nov | Payment closes; verification done |
| 24 Nov | Check-in, results, leaderboard |

Registration opens the day after this plan was written. A ten-phase build with a pause for approval after each phase will not have a tested, deployed registration flow by then. The organisers need to choose one:

- **Option A (recommended): open registration on 14 November and keep the 18 November close.** Five days is still enough for teams to write an idea. Phases 2–4 are built as one block with a single review at the end.
- **Option B: keep 12 November.** Put up a "registration opens shortly" page with the event information on the 12th, and switch the form on as soon as Phases 2–4 pass their tests.
- **Option C: keep the existing prototype running for intake.** Not advised: its rules, fee and team sizes contradict this event, and its data would need manual migration.

Whichever is chosen, the order below delivers each capability before its date. Dates assume approval of this plan on 11–12 November and that the prerequisites below are supplied promptly.

## Prerequisites from the organisers

Work that touches real infrastructure cannot start without these:

1. A Cloudflare account, and whether the Workers Paid plan (USD 5 per month) is acceptable if the free limits are exceeded.
2. The domain or subdomain the site will use, with DNS on Cloudflare.
3. An email provider account (Brevo or Resend) and a sending domain on which SPF and DKIM records can be added; and whether to pay for one month or accept slower bulk sends.
4. bKash and Nagad recipient numbers.
5. Contact email and phone, organising team names, problem domains, and the final rules text.
6. Confirmation of the defaults in `PRD.md` section 6, especially A1 (replace the existing prototype) and the upload design in `ARCHITECTURE.md` section 5.

## Phases

### Phase 2 — Infrastructure (target 12 Nov)
- Restructure to `src/`, remove the prototype's data layer and pages, keep the assets listed in `ARCHITECTURE.md` section 2.
- TypeScript strict, Tailwind 4 tokens, shadcn/ui, Geist.
- `@opennextjs/cloudflare`, `wrangler.jsonc` with D1, R2, rate-limit and cron bindings.
- Drizzle schema, first migration, seed and create-admin scripts.
- Typed environment access; Vitest and Playwright wired; GitHub Actions for lint, typecheck, test, build.
- **Spikes that decide open questions:** production build runs under `wrangler dev`; bundle size and CPU time against free-plan limits; Argon2id cost; `cacheComponents` and `proxy.ts` behaviour on OpenNext.

Exit: a deployed preview that reads a row from D1 and writes and reads an object in R2; CI green; spike results written into `ARCHITECTURE.md`.

### Phase 3 — Public website (target 13 Nov)
Design system components, layout, home page with all sections, the static pages, schedule and leaderboard shells reading from D1, Lenis, SEO metadata, sitemap, robots, structured data, social image.

Exit: Lighthouse targets met on home and register; keyboard walkthrough clean; reduced-motion verified.

### Phase 4 — Registration (target 14 Nov)
Upload endpoint and file service, five-step wizard, server validation, uniqueness and idempotency, registration batch, email outbox with cron drain, confirmation template, status tokens.

Exit: Workflow A passes end to end on the preview with a real email delivered; duplicate, invalid-file and rate-limit tests pass.

**Review gate 1: registration can open.**

### Phase 5 — Admin (target 18 Nov)
Login, sessions, permissions, activity log, dashboard, registration list and detail, secure file viewing, CSV export, review and scoring, comparison, shortlist with cap and override, finalisation.

Exit: Workflow B passes; unauthorised-access and over-capacity tests pass.

**Review gate 2: reviewing can start.**

### Phase 6 — Phase 2 payments (target 20 Nov)
Shortlist and non-selection emails, status page with link and one-time code, payment form, payment dashboard, verify and reject, confirmation emails.

Exit: Workflow C passes; duplicate-transaction and second-approval tests pass.

**Review gate 3: shortlist can be announced.**

### Phase 7 — Event day (target 22 Nov)
Confirmed-teams list, check-in with optional QR scan, schedule and announcement editors, reminder emails.

### Phase 8 — Results (target 23 Nov)
Score entry, ranking, preview, publish and unpublish, podium and leaderboard, results email.

Exit: Workflow D passes; unpublished data is absent from every public response.

### Phase 9 — Security and QA (continuous, sign-off 23 Nov)
Each phase carries its own tests. This phase is the final pass: the full security test list in `TESTING.md`, header and CSP check, accessibility audit, Lighthouse, load test of registration, restore drill for D1.

### Phase 10 — Deployment (first production deploy with Phase 4)
Production is deployed at review gate 1 and updated at each gate; the steps are in `DEPLOYMENT.md`. Phase 10 as a closing step is the final production verification before 24 November.

## Scope held back if time runs short

In this order: GSAP sequences, idea comparison view, QR scanning (list check-in remains), announcement broadcast emails, admin two-factor authentication. None of these blocks a participant or an organiser from completing a workflow.

## Phase report format

At the end of each phase: features completed, files changed, decisions and why, tests run with results, what remains, and anything that did not work.
