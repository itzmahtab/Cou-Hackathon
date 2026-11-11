# Testing Strategy

Planned for Phase 2 onward. **No tests for the new platform exist yet.** The only test in the repository today is `utils/rules.test.ts`, which belongs to the prototype being replaced.

A feature is reported as complete only when the tests listed for it here exist and pass, and the report says which were run.

## 1. Tools

| Layer | Tool | Runs against |
| :--- | :--- | :--- |
| Unit | Vitest | Pure functions, no I/O |
| Integration | Vitest with `@cloudflare/vitest-pool-workers` | Real local D1 and R2 inside the Workers runtime, migrations applied per test file |
| End to end | Playwright (Chromium, plus a mobile viewport) | The built Worker under `wrangler dev`, and the preview deployment |
| Static | `tsc --noEmit` (strict), ESLint | Whole repository |
| Audit | Lighthouse CI, axe via Playwright | Home, register, leaderboard, admin login |

Test doubles: the email provider is replaced by an in-memory adapter that records sends; Turnstile uses Cloudflare's published always-pass and always-fail test keys. D1 and R2 are never mocked in integration tests.

## 2. Unit tests

| Area | Cases |
| :--- | :--- |
| Registration schema | Team size 0 and 4 rejected; member count must equal size; each required field; text length bounds; consents must all be true; unknown keys rejected |
| Normalisation | Email lower-casing; phone `01…` → `+8801…` and invalid prefixes rejected; team-name and university normalisation collide as intended ("Team  A" vs "team a") |
| File sniffing | Real JPEG, PNG, WebP, PDF, DOCX accepted; EXE renamed `.pdf`, HTML renamed `.jpg`, SVG, a plain ZIP renamed `.docx`, and a truncated file rejected; size limits per category |
| Scoring | Each criterion's bounds; total; mean across reviewers; ordering with ties |
| Status transitions | Every allowed pair accepted; every other pair rejected |
| Payment schema | Amount must equal the fee; transaction-ID normalisation; provider enum |
| Permissions | Full role × permission matrix from `API_DOCUMENTATION.md` |
| Registration ID | Format, alphabet, no ambiguous characters |
| Phase windows | Open and close boundaries in Asia/Dhaka, including the last second of the closing day |
| Email templates | Each renders subject, HTML and text; interpolated values are escaped |
| CSV | Quoting; formula-injection prefixing |

## 3. Integration tests

| Area | Cases |
| :--- | :--- |
| Registration | Creates team, participants, idea, attached files, status tokens and one outbox row per member in one batch |
| Uniqueness | Duplicate email, duplicate (university, student ID), duplicate team name each return `409` with the right field and leave no partial rows |
| Idempotency | Same key twice → one team, same response |
| Concurrency | Two simultaneous registrations sharing an email → exactly one succeeds |
| Uploads | Wrong type and oversize rejected with nothing written to R2; a file from another upload session cannot be attached; orphan cleanup deletes object and row |
| File access | No session → 401; reviewer requesting a student ID → 403; registration admin → 200 with attachment headers |
| Auth | Correct login sets a `__Host-` HttpOnly cookie; wrong password and unknown email return the same response; expired and revoked sessions rejected; sixth attempt in 15 minutes → 429 |
| CSRF | Missing or foreign `Origin` rejected; missing CSRF token on an admin mutation rejected |
| Reviews | Upsert per reviewer; aggregate recalculated; first review moves team to `UNDER_REVIEW` |
| Shortlist | 30 accepted, 31st → `409 SHORTLIST_FULL`; override without justification rejected; override by non-super-admin → 403; two concurrent adds at 29 → exactly one succeeds |
| Finalisation | Statuses set; outbox rows created once; second call → `409 ALREADY_FINALISED` with no new emails |
| Payments | Non-shortlisted team → 403; outside window → 403; wrong amount → 400; duplicate transaction ID → 409; second submission while one is pending → 409 |
| Verification | Verify sets payment and team state, creates attendance rows, queues emails; verifying twice is a no-op; second verified payment for a team is impossible; reject requires a reason |
| Email outbox | Queued → sent; provider failure → retry with backoff → dead after the limit; duplicate dedupe key ignored; admin resend creates a new generation |
| Status access | Token works; code works once; wrong code five times locks it; mismatched registration ID and email gives the same response as a match |
| Leaderboard | Unpublished → `{ published: false }` and no scores anywhere in the body; published → public fields only; unpublish hides again; publish refused unless ranks 1–3 are each assigned once |
| Rate limits | Registration 6th request per IP in 15 minutes → 429; payment 6th per team per hour → 429 |

## 4. End-to-end workflows

**A. Registration.** A team of three completes all five steps on a mobile viewport, uploads three ID images and a PDF, submits, sees a registration ID; three confirmation emails are recorded; the admin sees the team and can open each file.

**B. Shortlist.** A reviewer scores seeded ideas; an admin selects 30; a 31st is refused; the super admin finalises; shortlisted and non-selected members each have exactly one queued email; the status page shows the new state.

**C. Payment.** A shortlisted team opens the status link, submits a payment, sees "under verification"; the payment admin verifies; the team shows as confirmed and members are emailed. A second run covers reject and resubmit.

**D. Results.** The results admin enters scores, previews, publishes; the public leaderboard shows the podium with the right teams and prizes; unpublish returns it to pending.

Also covered end to end: wizard keeps its draft across a refresh; double-clicking submit creates one registration; the register page outside the window shows the notice and no form; every admin page redirects to login without a session and returns 403 for the wrong role.

## 5. Security cases (explicit list from the brief)

| Case | Covered in |
| :--- | :--- |
| Unauthorised admin access | Integration: auth, file access; E2E: admin pages |
| Invalid file uploads | Unit: sniffing; integration: uploads |
| Duplicate transactions | Integration: payments |
| Duplicate registrations | Integration: uniqueness, idempotency, concurrency |
| Rate-limit violations | Integration: rate limits, auth |
| Unauthorised file access | Integration: file access; E2E: direct file URL without a session |
| Invalid status transitions | Unit: transitions; integration: verification, finalisation |
| Exceeding the shortlist limit | Integration: shortlist; E2E: workflow B |
| Private data in public responses | Integration: leaderboard, status access, and a test that scans every public endpoint's response for seeded emails, phones and student IDs |

## 6. Non-functional checks

- Lighthouse CI budgets: Performance 90, Accessibility 95, Best Practices 95, SEO 95, on mobile emulation.
- axe: no serious or critical violations on the audited pages.
- Manual: keyboard-only pass through registration; screen-reader pass (NVDA or VoiceOver) on the wizard; reduced-motion pass; one real Android device and one iPhone.
- Load: 50 concurrent registrations against preview with distinct data; all succeed, none duplicated, p95 response recorded.
- Deliverability: confirmation email checked in Gmail, Outlook and a university mailbox for spam placement and rendering.

## 7. Commands (to be added in Phase 2)

```bash
pnpm typecheck
```
```bash
pnpm lint
```
```bash
pnpm test
```
```bash
pnpm test:e2e
```

CI runs the first three on every push and the fourth against the preview deployment on pull requests.
