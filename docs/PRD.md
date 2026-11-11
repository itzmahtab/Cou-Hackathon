# Product Requirements — CoU AI Hackathon 2026

Status: **Phase 1 (planning) draft, awaiting approval.** Nothing in this document is implemented yet.

## 1. Product

A hackathon management platform for **CoU AI Hackathon 2026**, the flagship competition of *CoU Technova 2026 — AI & Technology Carnival*, presented by the Faculty of Engineering, Comilla University. Title sponsor: Gigabyte AORUS. Powered by: IT Palace, Kandirpar, Cumilla.

| Fact | Value |
| :--- | :--- |
| Format | On-site, 6 hours |
| Venue | Comilla University, Bangladesh |
| Event date | 24 November 2026 |
| Prize pool | BDT 25,000 (10,000 / 8,000 / 7,000) |
| Team size | 1–3, cross-university allowed |
| Phase 1 (free idea submission) | 12–18 November 2026 |
| Evaluation and shortlist | 19–20 November 2026 (editable) |
| Phase 2 (payment, top 30 only) | 21–23 November 2026 |
| Fee | BDT 1,350 per **team**, bKash or Nagad Send Money, verified by hand |
| Tagline | "Six Hours. One Vision. Infinite Possibilities." |

All dates are interpreted in **Asia/Dhaka (UTC+6)**. A window "12–18 November" opens at 00:00 on the 12th and closes at 23:59:59 on the 18th. Timestamps are stored in UTC.

## 2. Users

| User | Needs |
| :--- | :--- |
| Participant | Understand the event, register a team in one sitting on a phone, know where the team stands, pay if shortlisted. |
| Reviewer | Read ideas and documents, score against five criteria, leave private notes. |
| Registration admin | See, search, filter and export registrations; inspect ID cards. |
| Payment admin | Match transaction IDs against bKash / Nagad statements; verify or reject. |
| Results admin | Enter final scores, publish and unpublish the leaderboard. |
| Super admin | Everything, plus settings, admin accounts, shortlist finalisation and overrides. |
| Public visitor | Schedule, rules, prizes, leaderboard. |

Participants have **no accounts**. They identify themselves with a registration ID plus a secret link or an emailed one-time code (section 6).

## 3. Scope

### In scope
1. Public site: Home, About, Challenges, Rules, Registration, Registration Status, Payment Instructions, Schedule, Prizes, FAQ, Contact, Leaderboard, Privacy Policy, Terms.
2. Phase 1 registration: five-step form, per-member student ID image, idea document (PDF or DOCX), confirmation email to every member.
3. Admin: dashboard, registration management, CSV export, idea review and scoring, top-30 shortlist with audited override, payment verification, check-in, schedule and announcement editing, final results, email log and resend, activity log, settings.
4. Phase 2: shortlist and non-selection emails, payment submission, manual verification, confirmation emails.
5. Public leaderboard with podium, published by an admin.
6. Transactional email with an outbox, retries and duplicate-send prevention.

### Out of scope
- Automatic bKash / Nagad verification. No official gateway is integrated; faking one is explicitly forbidden.
- Participant accounts and passwords.
- Online code submission, repository snapshots and the online judging round that exist in the current prototype.
- Rocket as a payment method.
- Admin two-factor authentication (designed for, not built in the first release; see `SECURITY.md`).

## 4. Functional requirements

### 4.1 Registration (Phase 1)
- FR-1 Team name, team size (1, 2 or 3). Member forms are generated from team size.
- FR-2 Per member: full name, email, phone, WhatsApp (may equal phone), university, student ID, student ID image, T-shirt size (S–XXXL). The first member is the team leader and primary contact.
- FR-3 Idea: title, problem statement, proposed solution, AI component, expected impact, one document (PDF or DOCX).
- FR-4 Review step with three mandatory consents: rules, accuracy, communications.
- FR-5 The server rejects: a participant email already registered, a (university, student ID) pair already registered, a team name already taken (case- and whitespace-insensitive), a team size that does not match the member count, a missing file, and submissions outside the Phase 1 window.
- FR-6 On success: a registration ID of the form `COU26-XXXXXX`, files in private R2, one confirmation email per member, and a success screen showing the ID.
- FR-7 A repeated submit (double click, retry, refresh) creates exactly one registration.

### 4.2 Review and shortlist
- FR-8 Each reviewer scores an idea once (editable until the shortlist is finalised): relevance 20, innovation 25, AI application 25, feasibility 15, impact 15.
- FR-9 A team's review score is the mean of its reviewers' totals.
- FR-10 Admins mark candidates; the system refuses a 31st candidate. A super admin may exceed 30 only with a written justification, which is logged.
- FR-11 Finalising the shortlist sets every candidate to `SHORTLISTED` and every other active team to `NOT_SELECTED`, queues one email per participant, and is not repeatable. Emails can be resent individually by an admin.

### 4.3 Payment (Phase 2)
- FR-12 Only shortlisted teams can open the payment form, and only inside the Phase 2 window.
- FR-13 Fields: provider, sender number, transaction ID, amount, optional screenshot. Amount must equal the configured fee.
- FR-14 A transaction ID is unique per provider. A team can have at most one verified payment and at most one pending submission.
- FR-15 Verify sets the team to `CONFIRMED` and emails every member. Reject requires a reason, emails every member, and permits resubmission only if the window is open and resubmission is enabled.

### 4.4 Event day and results
- FR-16 Check-in list of confirmed teams with per-member attendance; QR on the confirmation email encodes a check-in token (optional scan).
- FR-17 Schedule and announcements are edited in the admin panel and rendered on the public site.
- FR-18 Results admins enter a final score, rank, prize and private feedback per team. Nothing is public until published; unpublishing hides it again.

### 4.5 Status tracking
- FR-19 A participant sees the team's stage and next action after proving control of a member email (secret link from an email, or a one-time code).

## 5. Non-functional requirements

| Area | Target |
| :--- | :--- |
| Lighthouse (mobile, home) | Performance 90+, Accessibility 95+, Best Practices 95+, SEO 95+ |
| Motion | Honours `prefers-reduced-motion`; Lenis disabled when set |
| Availability | Cloudflare edge; no single server to keep running |
| Privacy | Student IDs, phones, emails, documents and reviewer notes never reach a public response |
| Cost | Free tiers where they are sufficient; known exceptions listed in `ARCHITECTURE.md` section 9 |

## 6. Ambiguities and the defaults chosen

Each of these is a decision I made where the brief was silent or contradictory. Say so if any is wrong.

| # | Question | Default |
| :-- | :--- | :--- |
| A1 | The repository already contains a working prototype with different rules (3–4 members, BDT 1,000 fee paid at registration, team logins, online round, PostgreSQL + Supabase). Keep or replace? | **Replace.** Rebuild under `src/` on D1 / R2 / Drizzle. Keep the brand assets, the neural canvas, the QR component and the landing copy. Details in `ARCHITECTURE.md` section 2. |
| A2 | Site branding: the poster says "CoU Technova 2026"; the brief says "CoU AI Hackathon 2026". | The site is the hackathon's. Technova appears as the parent carnival in the header lockup, footer and sponsor strip. |
| A3 | What does "duplicate student ID" mean across universities? | Unique per (normalised university, student ID). |
| A4 | Who is the team leader? | Member 1. Used as primary contact; all members receive every email. |
| A5 | File limits | ID image: JPEG, PNG or WebP, 3 MB. Idea document: PDF or DOCX, 10 MB. Payment screenshot: JPEG, PNG or WebP, 3 MB. All configurable. |
| A6 | Phone format | Bangladeshi mobile, stored as `+8801XXXXXXXXX`; `01XXXXXXXXX` accepted on input. |
| A7 | Can a team edit a registration after submitting? | No. Admins can correct participant fields; every correction is logged. |
| A8 | Fewer than 30 teams pass review | The shortlist may be finalised with fewer than 30. |
| A9 | Ties at rank 30 | The admin chooses; the override path exists for taking 31. |
| A10 | Status verification | Secret link in every email (no extra email cost), with a one-time code as fallback. |
| A11 | Is the leaderboard limited to the top three? | It lists every confirmed team that has a published score; the podium shows the top three. |
| A12 | Organising team, contact numbers, problem domains, payment numbers | Placeholders stored in settings, editable in the admin panel. I will not invent real names or numbers. |
| A13 | Where do the planning documents live? | `docs/`, with `README.md` at the root. |

## 7. Schedule risk

Today is 11 November 2026. **Phase 1 registration is due to open tomorrow.** The ten-phase plan with an approval gate after each phase cannot deliver a tested registration flow by then. `DEVELOPMENT_PHASES.md` proposes an order that ships each capability before the date it is needed and names the decision this requires from the organisers.

## 8. Success criteria

- A team of three can register on a mid-range Android phone in under ten minutes.
- No organiser needs a spreadsheet or a database console between 12 and 24 November.
- Every status change a participant cares about produces exactly one email per member.
- Workflows A–D in `TESTING.md` pass end to end against a deployed preview.
