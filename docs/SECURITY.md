# Security Design

Phase 1 design. Each control is verified by a test listed in `TESTING.md` before it is called done.

## 1. What is being protected

| Asset | Sensitivity |
| :--- | :--- |
| Student ID card images | High: identity documents |
| Participant emails, phone numbers, student IDs | High |
| Payment sender numbers, transaction IDs, screenshots | High |
| Idea documents, reviewer notes and scores | Confidential until results |
| Admin credentials and sessions | Critical |
| Unpublished results | Confidential |

Main threats: scraping personal data, forged or replayed payment claims, spam registrations, admin account takeover, malicious uploads, and one team learning another team's data.

## 2. Input

- Every request body is parsed by a Zod schema on the server, with `.strict()` objects. The client uses the same schema for early feedback only.
- All text is stored as entered after trimming and Unicode NFC normalisation, and is rendered through React's escaping. No user text is ever passed to `dangerouslySetInnerHTML`. Email templates escape every interpolated value.
- CSV export prefixes cells beginning with `=`, `+`, `-`, `@`, tab or carriage return with an apostrophe, to stop spreadsheet formula injection.
- Queries go through Drizzle with bound parameters. No string-built SQL.
- Request bodies are capped: 64 KB for JSON, the per-category limit plus overhead for uploads.

## 3. Admin authentication

- Accounts are created only by `scripts/create-admin.ts` or by a super admin. No public sign-up, no default password.
- **Password hashing.** The brief asks for Argon2id. On Workers that means a WebAssembly or pure-JavaScript implementation, and its cost counts against the request CPU limit (10 ms on the free plan, which no sound parameter set fits). Plan: Argon2id (19 MiB, 2 iterations, parallelism 1, the OWASP minimum) on the Workers Paid plan, benchmarked in Phase 2. If it proves impractical, the fallback is scrypt through `node:crypto` (N = 2^17, r = 8, p = 1). Hashes are stored as PHC strings, so the algorithm can change without a data migration. PBKDF2 through Web Crypto is not proposed: Workers cap it at 100,000 iterations, well under current guidance.
- Password policy: 12 characters minimum, checked against a short list of common passwords. Forced change on first login.
- Sessions: 256-bit random token; only its SHA-256 is stored. Cookie `__Host-cou_admin`, `HttpOnly; Secure; SameSite=Lax; Path=/`. Idle timeout 2 hours, absolute 12 hours. Password change revokes all other sessions.
- Login throttling: 5 attempts per IP and 5 per email per 15 minutes, stored in D1, plus Turnstile. One generic failure message. A dummy hash is computed for unknown emails so timing does not reveal which accounts exist.
- Two-factor authentication (TOTP) is optional in the brief and deferred. The session model leaves room for it. Recommended for super admins if time allows after the event-critical work.

## 4. Authorisation

- `requirePermission()` runs at the top of every admin route handler and admin page. There is no reliance on hiding links or on edge middleware.
- Responses are shaped per role: reviewers do not receive contact details or ID images; payment admins do not receive review notes.
- Status transitions are checked against a transition table on the server.
- Every admin mutation, file download, export and login (including failures) writes to `admin_activity_logs`.

## 5. CSRF and CORS

- `SameSite=Lax` cookies.
- Every non-GET request must have an `Origin` equal to the configured site origin.
- Admin mutations must send `X-CSRF-Token`, derived from a per-session secret.
- No CORS headers are emitted. The API is same-origin only.

## 6. Bots and abuse

| Endpoint | Limit | Key |
| :--- | :--- | :--- |
| Registration | 5 per 15 min | IP |
| Uploads | 20 per 15 min | IP |
| Admin login | 5 per 15 min | IP, and separately email |
| Payment | 5 per hour | team |
| Status code request | 3 per 15 min / 10 per hour | registration / IP |
| Status code verify | 5 attempts per code | code |
| Contact | 3 per hour | IP |

Long-window counters are fixed windows in the D1 `rate_limits` table, incremented atomically. The Workers Rate Limiting binding (10 s and 60 s periods only) guards against bursts in front of them, and one WAF rate-limiting rule covers `/api/*` as a flood guard. The client IP is taken from `CF-Connecting-IP` only.

Turnstile tokens are verified server-side on registration, upload, login, status code request and contact. Duplicate submissions are stopped by the idempotency key and by unique indexes.

## 7. Files

- Private R2 bucket, no public domain, reachable only through the Worker binding.
- Type decided by magic bytes; allowed set per category. DOCX is confirmed by inspecting the ZIP directory for `[Content_Types].xml` and `word/document.xml`. Anything else is rejected, which excludes executables, scripts, HTML and SVG.
- Size is enforced before and during the read.
- Object keys are `<category>/<uuid>.<ext>` generated on the server. The client filename is sanitised and kept for display only; it never reaches a path, which removes path traversal.
- Downloads go through an authorised endpoint with `Content-Disposition: attachment` (inline only for the three image types), `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, and `Cache-Control: private, no-store`.
- Uploaded documents are not opened or parsed on the server beyond the header check. Reviewers should be told that a PDF or DOCX from a stranger can still be hostile and to open them in a browser viewer.
- No antivirus scan is available on the free platform. This is a known gap.
- Orphaned uploads are removed after 24 hours.

## 8. Participant status access

- A registration ID alone reveals nothing.
- Each participant has a 256-bit status token (stored hashed) embedded in their emails. The fallback is a six-digit code emailed to a member address: 10-minute expiry, 5 attempts, stored hashed.
- The status-code request answers identically whether or not the registration ID and email match.
- The status cookie is scoped to one team, lasts 30 minutes, and exposes only the fields listed in `APP_FLOW.md` section 7.
- The duplicate-email error at registration necessarily confirms that an address is registered. Turnstile and the registration rate limit bound that leak; it is accepted because a clear error matters more to honest users.

## 9. Headers

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(self), microphone=(), geolocation=()
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-…' https://challenges.cloudflare.com;
  frame-src https://challenges.cloudflare.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self';
  object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

`camera=(self)` is for QR check-in. `style-src 'unsafe-inline'` is required by the animation library's inline styles. A nonce-based script policy forces dynamic rendering in Next.js; if that costs too much on public pages, they fall back to a hash-based policy and the nonce stays on admin pages. Decided in Phase 3 with measurements.

## 10. Secrets

Stored with `wrangler secret put` and as GitHub Actions secrets; never in the repository and never in a `NEXT_PUBLIC_` variable. The Turnstile site key is the only security-related value sent to the browser. Local development uses `.dev.vars`, which is git-ignored. Full list in `ENVIRONMENT_VARIABLES.md`.

## 11. Privacy and retention

- Public endpoints select explicit columns; there is no public route that serialises a participant row.
- Logs record IDs, not personal data. Email bodies are not logged.
- Retention: ID images and payment screenshots deleted 30 days after the event; contact details 90 days after. Stated in the privacy policy. The purge is a logged super-admin action.
- Exports are limited to two roles and every export is logged with its filters.

## 12. Known gaps accepted for this release

1. No malware scanning of uploads.
2. No admin two-factor authentication.
3. Payment verification is manual and depends on an admin reading the provider statement correctly.
4. Fixed-window rate limits allow a short burst across a window boundary.
