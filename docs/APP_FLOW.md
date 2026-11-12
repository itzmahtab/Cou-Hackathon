# Application Flow

## 1. Team lifecycle

Two stored fields describe a team: `teams.status` and the state of its payments. The status shown to participants is derived from both.

```
                 register
                    │
                    ▼
              ┌───────────┐  first review saved  ┌──────────────┐
              │ SUBMITTED │ ───────────────────► │ UNDER_REVIEW │
              └─────┬─────┘                      └──────┬───────┘
                    │        shortlist finalised        │
                    ├───────────────┬───────────────────┤
                    ▼               ▼
            ┌──────────────┐  ┌─────────────┐
            │ NOT_SELECTED │  │ SHORTLISTED │
            └──────────────┘  └──────┬──────┘
                                     │ payment verified
                                     ▼
                               ┌───────────┐
                               │ CONFIRMED │
                               └───────────┘

Any state ──(super admin, with reason)──► DISQUALIFIED
```

Allowed transitions are a table in `features/registration/status.ts`; anything else is rejected with `409 INVALID_TRANSITION`.

| Stored status | Payment state | Shown to participant |
| :--- | :--- | :--- |
| `SUBMITTED` | — | Submitted |
| `UNDER_REVIEW` | — | Under review |
| `NOT_SELECTED` | — | Not selected |
| `SHORTLISTED` | none, or latest rejected | Payment pending |
| `SHORTLISTED` | pending | Payment under verification |
| `CONFIRMED` | verified | Confirmed |

Payment row states: `PENDING_VERIFICATION → VERIFIED` or `PENDING_VERIFICATION → REJECTED`. `NOT_SUBMITTED` is the absence of a row.

## 2. Workflow A — registration

1. Visitor opens `/register`. Outside the Phase 1 window the page shows the opening or closing notice instead of the form.
2. The wizard creates an upload-session ID and keeps the draft in `sessionStorage` (text fields only), so a refresh does not lose work.
3. Step 1, team. Step 2, one panel per member; each ID image uploads as soon as it is chosen and shows progress, a thumbnail and a replace button. Step 3, idea and document. Step 4, review and three consents. Each step validates with the shared Zod schema before advancing.
4. Submit sends JSON (fields, file IDs, Turnstile token, an idempotency key generated when the wizard opened). The button disables while pending.
5. Server: rate limit → Turnstile → window check → Zod → normalise → attach files and insert team, participants and idea in one D1 batch → queue one confirmation email per member → respond with the registration ID.
6. Unique-index violations come back as field errors ("This email is already registered in another team") and the wizard jumps to the offending step.
7. A replay with the same idempotency key returns the original response.
8. Success screen: registration ID, a copy button, "Phase 1 is free; results arrive by email on 19–20 November".

## 3. Workflow B — review and shortlist

1. A reviewer opens `/admin/reviews`: a sortable, filterable table (status, university, team size, score, reviewed-by-me).
2. The review page shows the idea fields, a document link, five score inputs with their maxima, and private notes. Saving the first review moves the team to `UNDER_REVIEW`.
3. `/admin/shortlist` ranks teams by mean score. An admin toggles "candidate" per team; a counter shows `n / 30`. The 31st toggle is refused. A super admin sees an "override" control that requires a justification of at least 20 characters. Every toggle writes to `shortlist_selections`.
4. Compare view: up to three ideas side by side.
5. "Finalise shortlist" (super admin) shows the two lists and their counts and asks for the phrase `FINALISE` to be typed. One batch sets statuses, records the finalisation in settings, and queues the emails. The button is then replaced by the finalisation record.
6. The cron drains the outbox. `/admin/emails` shows per-recipient delivery state with resend.

## 4. Workflow C — payment

1. The shortlist email carries a personal link to `/status?t=<token>`. The status page shows "Payment pending", the bKash and Nagad numbers from settings, the amount and the deadline, and a link to the payment form.
2. `/payment` is reachable only with a verified status session for a `SHORTLISTED` team inside the Phase 2 window. Registration ID and team name are prefilled and read-only.
3. Submit: rate limit (per team) → Zod → amount equals the fee → insert. The unique index on (provider, transaction ID) and the partial unique index on one open payment per team decide races.
4. Members get "payment received"; payment admins get a notification email.
5. `/admin/payments`: filter by status and provider, search by transaction ID or sender number. Verify or reject (reason required) with an optional internal note. Each action writes to `payment_verification_logs`.
6. Verify: payment `VERIFIED`, team `CONFIRMED`, attendance rows created, confirmation email with the check-in QR. Reject: payment `REJECTED`, rejection email with the reason; the form reopens if resubmission is allowed.

## 5. Event day

1. `/admin/event` lists confirmed teams. A check-in desk searches by team name or registration ID, or scans the QR, and ticks present members. The team shows as checked in when at least one member is present.
2. Schedule items and announcements are edited here and appear on `/schedule` and the home page.

## 6. Workflow D — results

1. `/admin/results`: one row per confirmed team with final score, rank, prize and private judge feedback. Rank can be filled automatically from score and then adjusted.
2. Preview renders the public leaderboard from the unpublished data, visible to admins only.
3. Publish requires ranks 1–3 to be assigned exactly once each. It records a `leaderboard_publications` row and revalidates the public page. Optionally queues the results email.
4. `/leaderboard` shows a "results pending" state until published, then the podium and the table. Unpublish restores the pending state.

## 7. Status check

1. `/status` with `?t=` from any email: the token is verified and exchanged for a short-lived status cookie; the URL is cleaned.
2. Without a token: enter registration ID and a member email. If they match, a six-digit code is emailed. The response is identical whether or not they match. The code expires in 10 minutes and allows five attempts.
3. The page shows a timeline (Registered → Review → Shortlist → Payment → Confirmed), the current stage, the next action and its deadline. It shows team name, idea title and member first names; it never shows phone numbers, student IDs or documents.

## 8. Page map

| Public | Admin (permission) |
| :--- | :--- |
| `/` | `/admin/login` |
| `/about` | `/admin` (any admin) |
| `/challenges` | `/admin/registrations`, `/admin/registrations/[id]` (registrations.read) |
| `/rules` | `/admin/reviews`, `/admin/reviews/[teamId]` (reviews.write) |
| `/register` | `/admin/shortlist` (shortlist.manage) |
| `/status` | `/admin/payments` (payments.verify) |
| `/payment` | `/admin/participants` (registrations.read) |
| `/schedule` | `/admin/emails` (emails.manage) |
| `/prizes` | `/admin/event` (event.manage) |
| `/faq` | `/admin/results` (results.manage) |
| `/contact` | `/admin/logs` (logs.read) |
| `/leaderboard` | `/admin/settings` (settings.manage) |
| `/privacy`, `/terms` | |
