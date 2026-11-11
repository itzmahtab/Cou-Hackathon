# Deployment

Target: one Cloudflare Worker built with `@opennextjs/cloudflare`, one D1 database, one private R2 bucket. This is the planned procedure; the commands and file names become real in Phase 2 and this document is corrected against what was actually run.

## 1. Environments

| Environment | Worker | D1 | R2 | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| Local | `wrangler dev` / `next dev` | local SQLite in `.wrangler/` | local simulation | Development, integration tests |
| Preview | `cou-hackathon-preview` | `cou-hackathon-preview` | `cou-hackathon-files-preview` | Review gates, end-to-end tests |
| Production | `cou-hackathon` | `cou-hackathon` | `cou-hackathon-files` | Live |

Preview and production never share a database or bucket.

## 2. One-time setup

1. **Account.** Create or choose the Cloudflare account. Add the domain and move its DNS to Cloudflare.
2. **Resources.**
   ```bash
   pnpm wrangler d1 create cou-hackathon
   ```
   ```bash
   pnpm wrangler r2 bucket create cou-hackathon-files
   ```
   Repeat with the `-preview` names. Put the returned database IDs in `wrangler.jsonc`. Do not attach a public domain to the bucket.
3. **Turnstile.** Create a widget for the domain; note the site key and secret.
4. **Email.** Create the provider account, add the sending domain, publish its SPF and DKIM records in Cloudflare DNS, add a DMARC record, and create an API key restricted to sending.
5. **Secrets.** For each name in `ENVIRONMENT_VARIABLES.md` marked secret:
   ```bash
   pnpm wrangler secret put SESSION_SECRET
   ```
6. **Migrations.**
   ```bash
   pnpm wrangler d1 migrations apply cou-hackathon --remote
   ```
7. **Seed and first admin.**
   ```bash
   pnpm tsx scripts/seed.ts --remote
   ```
   ```bash
   pnpm tsx scripts/create-admin.ts
   ```
   The second script prompts for email and password and prints the statement to run with `wrangler d1 execute`.
8. **Custom domain.** Add the route in `wrangler.jsonc`, deploy, and confirm the certificate is active.
9. **Edge rules.** SSL mode Full (strict), Always Use HTTPS, one WAF rate-limiting rule on `/api/*`, Bot Fight Mode on.
10. **Cron.** `wrangler.jsonc` declares `* * * * *` (outbox) and `0 * * * *` (cleanup). Confirm both appear under the Worker's triggers.

## 3. Build and deploy

```bash
pnpm install --frozen-lockfile
```
```bash
pnpm opennextjs-cloudflare build
```
```bash
pnpm opennextjs-cloudflare deploy
```

Preview deploys use `--env preview`.

## 4. CI/CD (GitHub Actions)

| Workflow | Trigger | Steps |
| :--- | :--- | :--- |
| `ci.yml` | every push and pull request | install, lint, typecheck, unit and integration tests, build |
| `preview.yml` | pull request | apply migrations to preview D1, deploy preview, run Playwright against it |
| `deploy.yml` | push to `main` | apply migrations to production D1, deploy, smoke test |

Repository secrets: `CLOUDFLARE_API_TOKEN` (scoped to Workers Scripts, D1 and R2 edit on this account only) and `CLOUDFLARE_ACCOUNT_ID`. Runtime secrets live in Cloudflare, not in GitHub.

Migrations run before the deploy and must be backward compatible with the currently running code (add columns, do not rename or drop in the same release).

## 5. Verification after each production deploy

1. Home page loads over HTTPS; security headers present.
2. `GET /api/v1/event` returns settings from D1.
3. Admin login succeeds; a wrong password is rejected and logged.
4. Before registration opens only: one test registration with real files, confirmation email received, files visible to an admin and not reachable by URL without a session; then delete the test team.
5. Cron: an outbox row moves from `QUEUED` to `SENT` within two minutes.

## 6. Operations

- **Logs:** `pnpm wrangler tail cou-hackathon`, and Workers Logs in the dashboard.
- **Backup:** D1 Time Travel allows point-in-time restore for 30 days on the paid plan and 7 days on the free plan. In addition, export before each irreversible step (shortlist finalisation, results publication):
  ```bash
  pnpm wrangler d1 export cou-hackathon --remote --output backup-$(date +%F).sql
  ```
  Exports contain personal data; store them encrypted and delete them with the retention schedule.
- **Rollback:** `pnpm wrangler rollback` returns to the previous Worker version. Database changes are not rolled back by this, which is why migrations must be additive.
- **Registration closed early or reopened:** change the window in Admin → Settings; no deploy needed.
- **Email provider outage:** rows stay queued and retry; if prolonged, switch `EMAIL_PROVIDER` and its key, then redeploy.

## 7. Limits to watch

| Limit | Where to look | Action if reached |
| :--- | :--- | :--- |
| Worker CPU time or script size | Deploy output; Workers metrics | Workers Paid plan |
| Email daily quota | Provider dashboard; Admin → Emails backlog | Lower cron batch size, or upgrade for the month |
| D1 rows read per day | D1 metrics | Check for an unindexed query |
| R2 storage | R2 metrics | Not expected to be reached |

## 8. After the event

Run the retention purge at 30 and 90 days, export a final anonymised results snapshot, revoke the API tokens, and delete the preview resources.
