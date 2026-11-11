# API Contracts

Design for Phase 2 onward. All endpoints are Next.js route handlers under `/api/v1`. Nothing here exists yet.

## Conventions

- JSON in, JSON out, except `POST /uploads` (multipart) and file or CSV downloads.
- Success: `{ "ok": true, "data": … }`. Failure: `{ "ok": false, "error": { "code": "…", "message": "…", "fields": { "participants.1.email": "…" } } }`.
- State-changing requests must carry an `Origin` matching the site. Admin mutations also require `X-CSRF-Token`.
- Public form endpoints require a Turnstile token in `turnstileToken`.
- Lists paginate with `?page=&pageSize=` (max 100) and return `{ items, total, page, pageSize }`.

| HTTP | Code | Meaning |
| :--- | :--- | :--- |
| 400 | `VALIDATION_ERROR` | Zod failure; `fields` populated |
| 401 | `UNAUTHENTICATED` | No valid session |
| 403 | `FORBIDDEN`, `TURNSTILE_FAILED`, `WINDOW_CLOSED`, `BAD_ORIGIN` | |
| 404 | `NOT_FOUND` | Also returned for resources the caller may not know exist |
| 409 | `DUPLICATE`, `INVALID_TRANSITION`, `SHORTLIST_FULL`, `ALREADY_FINALISED` | |
| 413 | `FILE_TOO_LARGE` | |
| 415 | `UNSUPPORTED_FILE_TYPE` | |
| 429 | `RATE_LIMITED` | With `Retry-After` |

## Public

| Method and path | Purpose | Limit |
| :--- | :--- | :--- |
| `GET /event` | Public settings: phase windows, fee, payment numbers (only during Phase 2), contact, domains | — |
| `GET /schedule` | Published schedule items | — |
| `GET /announcements` | Published announcements | — |
| `GET /leaderboard` | `{ published: false }` or `{ published: true, podium, rows }` | — |
| `POST /uploads` | Upload one file | 20 per IP per 15 min |
| `POST /registrations` | Create a registration | 5 per IP per 15 min |
| `POST /status/otp` | Request a status code | 3 per registration per 15 min, 10 per IP per hour |
| `POST /status/verify` | Exchange a code or link token for a status cookie | 10 per IP per 15 min |
| `GET /status` | Team status (status cookie) | — |
| `POST /payments` | Submit a payment (status cookie, shortlisted team) | 5 per team per hour |
| `POST /contact` | Contact form, queued as email to organisers | 3 per IP per hour |

### POST /uploads
Multipart: `file`, `category` (`STUDENT_ID`, `IDEA_DOC`, `PAYMENT_SCREENSHOT`), `uploadSession`, `turnstileToken`.
Returns `{ fileId, sizeBytes, contentType }`. The stored type comes from magic bytes.

### POST /registrations
```json
{
  "idempotencyKey": "uuid",
  "uploadSession": "uuid",
  "turnstileToken": "…",
  "team": { "name": "Neural Nomads", "size": 2 },
  "participants": [
    {
      "fullName": "…", "email": "…", "phone": "01XXXXXXXXX", "whatsapp": "01XXXXXXXXX",
      "university": "Comilla University", "studentId": "…",
      "tshirtSize": "L", "idCardFileId": "uuid"
    }
  ],
  "idea": {
    "title": "…", "problemStatement": "…", "proposedSolution": "…",
    "aiComponent": "…", "expectedImpact": "…", "documentFileId": "uuid"
  },
  "consents": { "rules": true, "accuracy": true, "communications": true }
}
```
`201` → `{ registrationId: "COU26-7K2M9Q", teamName, participantCount }`.
`409 DUPLICATE` with `fields` naming the email, student ID or team name.

Field limits: team name 3–60; names 2–80; title 5–120; the four idea texts 50–2,000 characters each; university 2–120; student ID 2–40.

### GET /leaderboard (published)
```json
{
  "published": true,
  "podium": [{ "position": "CHAMPION", "rank": 1, "teamName": "…", "universities": ["…"], "projectTitle": "…", "totalScore": 91.5, "prizeBdt": 10000 }],
  "rows": [{ "rank": 4, "teamName": "…", "universities": ["…"], "projectTitle": "…", "totalScore": 78 }]
}
```
The handler builds this from an explicit column list. Feedback, emails, phones and review scores are not selected.

### GET /status
```json
{
  "registrationId": "COU26-7K2M9Q", "teamName": "…", "ideaTitle": "…",
  "members": ["Ayesha", "Rahim"],
  "stage": "PAYMENT_PENDING",
  "nextAction": { "label": "Submit payment", "href": "/payment", "deadline": "2026-11-23T17:59:59Z" },
  "payment": { "status": "REJECTED", "rejectionReason": "…", "canResubmit": true }
}
```

### POST /payments
`{ provider, senderPhone, transactionId, amountBdt, screenshotFileId? }` → `201 { status: "PENDING_VERIFICATION" }`.

## Admin authentication

| Method and path | Purpose |
| :--- | :--- |
| `POST /admin/auth/login` | `{ email, password, turnstileToken }` → sets the session cookie; 5 per IP and 5 per email per 15 min |
| `POST /admin/auth/logout` | Deletes the session |
| `GET /admin/auth/me` | `{ id, name, role, permissions, csrfToken }` |
| `POST /admin/auth/password` | Change own password; revokes other sessions |

Login failures return one generic message regardless of cause.

## Admin

| Method and path | Permission |
| :--- | :--- |
| `GET /admin/dashboard` — totals, team-size split, university distribution, daily trend, payment and email counts | any admin |
| `GET /admin/registrations?q=&university=&size=&status=` | registrations.read |
| `GET /admin/registrations/:teamId` | registrations.read |
| `PATCH /admin/participants/:id` — correct participant fields | registrations.write |
| `GET /admin/registrations/export.csv` | registrations.export |
| `GET /admin/files/:id` — authorised stream from R2 | by category: registrations.read, reviews.read or payments.verify |
| `GET /admin/reviews?status=&sort=` | reviews.read |
| `GET /admin/reviews/:teamId` — idea, own review, and (super admin) all reviews | reviews.read |
| `PUT /admin/reviews/:teamId` — upsert own scores and notes | reviews.write |
| `GET /admin/shortlist` — ranking, candidates, capacity, finalisation state | shortlist.read |
| `POST /admin/shortlist/candidates` — `{ teamId, selected, justification? }` | shortlist.manage; over-capacity needs shortlist.override |
| `POST /admin/shortlist/finalise` — `{ confirm: "FINALISE" }` | shortlist.finalise |
| `GET /admin/shortlist/export.csv` | registrations.export |
| `GET /admin/payments?status=&provider=&q=` | payments.verify |
| `POST /admin/payments/:id/verify` — `{ note? }` | payments.verify |
| `POST /admin/payments/:id/reject` — `{ reason, note? }` | payments.verify |
| `GET /admin/attendance`, `POST /admin/attendance` — `{ participantId, present }`, `POST /admin/attendance/scan` — `{ token }` | event.manage |
| `GET/POST/PATCH/DELETE /admin/schedule[/:id]` | event.manage |
| `GET/POST/PATCH/DELETE /admin/announcements[/:id]` | event.manage |
| `GET /admin/results`, `PUT /admin/results/:teamId` | results.manage |
| `GET /admin/results/preview` | results.manage |
| `POST /admin/results/publish`, `POST /admin/results/unpublish` | results.publish |
| `GET /admin/emails?status=&template=`, `POST /admin/emails/:id/resend` | emails.manage |
| `POST /admin/emails/broadcast` — `{ audience, subject, body }` | emails.broadcast |
| `GET /admin/logs?admin=&action=&entity=` | logs.read |
| `GET /admin/settings`, `PATCH /admin/settings` | settings.manage |
| `GET/POST/PATCH /admin/admins[/:id]` | admins.manage |
| `POST /admin/retention/purge` | admins.manage |

## Role → permission

| Permission | SUPER | REGISTRATION | REVIEWER | PAYMENT | RESULTS |
| :--- | :-: | :-: | :-: | :-: | :-: |
| registrations.read | ✓ | ✓ | | ✓ | ✓ |
| registrations.write, registrations.export | ✓ | ✓ | | | |
| reviews.read, reviews.write | ✓ | | ✓ | | |
| shortlist.read | ✓ | ✓ | ✓ | | |
| shortlist.manage | ✓ | | ✓ | | |
| shortlist.override, shortlist.finalise | ✓ | | | | |
| payments.verify | ✓ | | | ✓ | |
| event.manage | ✓ | ✓ | | | |
| results.manage, results.publish | ✓ | | | | ✓ |
| emails.manage | ✓ | ✓ | | | |
| emails.broadcast, settings.manage, admins.manage, logs.read | ✓ | | | | |

Reviewers see idea content and the idea document only: no phone numbers, emails or ID images. Payment admins see team name, leader contact and payment details, not ID images or review notes.

## Scheduled

`scheduled()` every minute: drain the email outbox; every hour: delete expired sessions, one-time codes, idempotency keys, rate-limit windows and orphaned uploads.
