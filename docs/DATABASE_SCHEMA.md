# Database Schema

Cloudflare D1 (SQLite) through Drizzle ORM. This is the design the Phase 2 migration will implement; the Drizzle source of truth will be `src/lib/db/schema.ts`.

## Conventions

- Primary keys: `id TEXT` holding a UUID v7 (sortable by creation time), except where noted.
- Timestamps: `INTEGER` Unix milliseconds, UTC. Every table has `created_at`; mutable tables have `updated_at`.
- Enumerations: `TEXT` with a `CHECK` constraint.
- `PRAGMA foreign_keys = ON` (D1's default). Deletes are restricted, not cascaded, unless stated.
- "Normalised" columns (`*_norm`) hold a lower-cased, whitespace-collapsed copy used only for uniqueness and search.

## Tables merged from the brief's suggested list

The brief lists 23 tables and also asks to avoid unnecessary duplication. Five suggestions are folded into others:

| Suggested | Decision | Reason |
| :--- | :--- | :--- |
| `registrations` | Merged into `teams` | Strictly one-to-one and created together; a second table would only add a join. |
| `admin_roles` | `admins.role` column | Five fixed roles defined in code. |
| `idea_files`, `participant_documents` | One `files` table with a `category` | Same lifecycle, same access rules. |
| `reviewer_scores` | Five columns on `idea_reviews` | The criteria are fixed; a child table would need pivoting for every ranking query. |
| `email_templates` | In code | Templates are typed functions versioned with the app. |

Added: `rate_limits`, `status_tokens`, `status_otps`, `idempotency_keys`.

## Tables

### admins
| Column | Type | Constraints |
| :--- | :--- | :--- |
| id | TEXT | PK |
| email | TEXT | UNIQUE, lower-case |
| name | TEXT | NOT NULL |
| password_hash | TEXT | NOT NULL, self-describing (PHC string) |
| role | TEXT | CHECK in `SUPER_ADMIN`, `REGISTRATION_ADMIN`, `REVIEWER`, `PAYMENT_ADMIN`, `RESULTS_ADMIN` |
| is_active | INTEGER | NOT NULL DEFAULT 1 |
| must_change_password | INTEGER | NOT NULL DEFAULT 1 |
| last_login_at | INTEGER | |
| created_at, updated_at | INTEGER | |

### admin_sessions
| Column | Type | Constraints |
| :--- | :--- | :--- |
| token_hash | TEXT | PK, SHA-256 of the cookie value |
| admin_id | TEXT | FK admins, ON DELETE CASCADE, indexed |
| csrf_secret | TEXT | NOT NULL |
| ip, user_agent | TEXT | |
| last_seen_at, expires_at, created_at | INTEGER | index on `expires_at` |

### teams
| Column | Type | Constraints |
| :--- | :--- | :--- |
| id | TEXT | PK |
| registration_id | TEXT | UNIQUE, `COU26-` + 6 Crockford base-32 characters |
| name | TEXT | NOT NULL |
| name_norm | TEXT | UNIQUE |
| size | INTEGER | CHECK between 1 and 3 |
| status | TEXT | CHECK in `SUBMITTED`, `UNDER_REVIEW`, `SHORTLISTED`, `NOT_SELECTED`, `CONFIRMED`, `DISQUALIFIED`; indexed |
| is_shortlist_candidate | INTEGER | NOT NULL DEFAULT 0, indexed |
| review_score_avg | REAL | maintained when reviews change; indexed |
| review_count | INTEGER | NOT NULL DEFAULT 0 |
| consent_rules, consent_accuracy, consent_comms | INTEGER | NOT NULL, CHECK = 1 |
| checkin_token_hash | TEXT | UNIQUE, nullable; set on confirmation |
| submitted_ip | TEXT | |
| created_at, updated_at | INTEGER | index on `created_at` |

University representation is derived from participants and not stored on the team.

### participants
| Column | Type | Constraints |
| :--- | :--- | :--- |
| id | TEXT | PK |
| team_id | TEXT | FK teams, indexed |
| position | INTEGER | CHECK between 1 and 3; 1 is the leader |
| full_name | TEXT | NOT NULL |
| email | TEXT | UNIQUE, lower-case |
| phone, whatsapp | TEXT | NOT NULL, `+8801XXXXXXXXX` |
| university | TEXT | NOT NULL |
| university_norm | TEXT | NOT NULL, indexed |
| student_id | TEXT | NOT NULL |
| student_id_norm | TEXT | NOT NULL |
| tshirt_size | TEXT | CHECK in `S`, `M`, `L`, `XL`, `XXL`, `XXXL` |
| id_card_file_id | TEXT | FK files, UNIQUE |
| created_at, updated_at | INTEGER | |

Unique: `(team_id, position)`, `(university_norm, student_id_norm)`.

### idea_submissions
| Column | Type | Constraints |
| :--- | :--- | :--- |
| id | TEXT | PK |
| team_id | TEXT | FK teams, UNIQUE |
| title | TEXT | NOT NULL |
| problem_statement, proposed_solution, ai_component, expected_impact | TEXT | NOT NULL |
| document_file_id | TEXT | FK files, UNIQUE |
| created_at, updated_at | INTEGER | |

### files
| Column | Type | Constraints |
| :--- | :--- | :--- |
| id | TEXT | PK |
| category | TEXT | CHECK in `STUDENT_ID`, `IDEA_DOC`, `PAYMENT_SCREENSHOT` |
| r2_key | TEXT | UNIQUE, server-generated |
| content_type | TEXT | NOT NULL, from magic bytes |
| size_bytes | INTEGER | NOT NULL |
| sha256 | TEXT | NOT NULL |
| original_name | TEXT | display only, sanitised, never used in a path |
| status | TEXT | CHECK in `PENDING`, `ATTACHED`, `DELETED`; index on `(status, created_at)` |
| upload_session | TEXT | NOT NULL, indexed |
| created_at | INTEGER | |

### idea_reviews
| Column | Type | Constraints |
| :--- | :--- | :--- |
| id | TEXT | PK |
| idea_id | TEXT | FK idea_submissions, indexed |
| reviewer_id | TEXT | FK admins |
| score_relevance | INTEGER | CHECK 0–20 |
| score_innovation | INTEGER | CHECK 0–25 |
| score_ai | INTEGER | CHECK 0–25 |
| score_feasibility | INTEGER | CHECK 0–15 |
| score_impact | INTEGER | CHECK 0–15 |
| total | INTEGER | generated: sum of the five |
| notes | TEXT | private |
| created_at, updated_at | INTEGER | |

Unique: `(idea_id, reviewer_id)`.

### shortlist_selections
Append-only record of every candidate change and of finalisation.

| Column | Type | Constraints |
| :--- | :--- | :--- |
| id | TEXT | PK |
| team_id | TEXT | FK teams, nullable for `FINALISE` |
| action | TEXT | CHECK in `ADD`, `REMOVE`, `OVERRIDE_ADD`, `FINALISE` |
| justification | TEXT | required when action is `OVERRIDE_ADD` (CHECK) |
| admin_id | TEXT | FK admins |
| created_at | INTEGER | |

### payments
| Column | Type | Constraints |
| :--- | :--- | :--- |
| id | TEXT | PK |
| team_id | TEXT | FK teams, indexed |
| provider | TEXT | CHECK in `BKASH`, `NAGAD` |
| sender_phone | TEXT | NOT NULL |
| transaction_id | TEXT | NOT NULL, upper-cased, trimmed |
| amount_bdt | INTEGER | NOT NULL |
| screenshot_file_id | TEXT | FK files, nullable |
| status | TEXT | CHECK in `PENDING_VERIFICATION`, `VERIFIED`, `REJECTED`; indexed |
| rejection_reason | TEXT | |
| internal_note | TEXT | private |
| decided_by | TEXT | FK admins |
| decided_at | INTEGER | |
| created_at, updated_at | INTEGER | |

Unique: `(provider, transaction_id)`.
Partial unique indexes: `(team_id) WHERE status = 'VERIFIED'` and `(team_id) WHERE status = 'PENDING_VERIFICATION'`. These make "one approved payment per team" and "one open submission per team" database guarantees.

### payment_verification_logs
`id`, `payment_id` FK, `admin_id` FK, `action` (`VERIFY`, `REJECT`, `NOTE`, `REOPEN`), `reason`, `created_at`. Append-only.

### email_outbox
Serves as both queue and delivery log.

| Column | Type | Constraints |
| :--- | :--- | :--- |
| id | TEXT | PK |
| dedupe_key | TEXT | UNIQUE |
| template | TEXT | NOT NULL |
| to_email | TEXT | NOT NULL |
| team_id, participant_id | TEXT | FK, nullable |
| payload_json | TEXT | template variables |
| status | TEXT | CHECK in `QUEUED`, `SENDING`, `SENT`, `FAILED`, `DEAD` |
| attempts | INTEGER | NOT NULL DEFAULT 0 |
| next_attempt_at | INTEGER | index on `(status, next_attempt_at)` |
| provider_message_id, last_error | TEXT | |
| requested_by | TEXT | FK admins, set for manual resends |
| sent_at, created_at, updated_at | INTEGER | |

### event_settings
`key TEXT PK`, `value_json TEXT`, `updated_by` FK admins, `updated_at`. Keys include phase windows, fee, bKash and Nagad numbers, file limits, screenshot-required flag, resubmission flag, shortlist capacity, shortlist finalised-at, contact details, problem domains, organising team.

### event_schedules
`id`, `title`, `description`, `starts_at`, `ends_at`, `sort_order`, `is_published`, timestamps.

### announcements
`id`, `title`, `body`, `is_published`, `published_at`, `created_by` FK admins, timestamps.

### attendance
`id`, `participant_id` FK UNIQUE, `team_id` FK indexed, `checked_in_at`, `checked_in_by` FK admins.

### final_results
| Column | Type | Constraints |
| :--- | :--- | :--- |
| id | TEXT | PK |
| team_id | TEXT | FK teams, UNIQUE |
| total_score | REAL | NOT NULL |
| rank | INTEGER | UNIQUE when not null |
| position | TEXT | CHECK in `CHAMPION`, `FIRST_RUNNER_UP`, `SECOND_RUNNER_UP`, or null; UNIQUE when not null |
| prize_bdt | INTEGER | |
| judge_feedback | TEXT | private |
| updated_by | TEXT | FK admins |
| created_at, updated_at | INTEGER | |

### leaderboard_publications
`id`, `action` (`PUBLISH`, `UNPUBLISH`), `admin_id` FK, `snapshot_json` (the public rows as published), `created_at`. The latest row decides whether the leaderboard is public.

### admin_activity_logs
`id`, `admin_id` FK nullable (failed logins), `action`, `entity_type`, `entity_id`, `detail_json`, `ip`, `created_at`. Indexed on `created_at` and `(entity_type, entity_id)`. Append-only.

### status_tokens
`token_hash TEXT PK`, `participant_id` FK, `created_at`, `revoked_at`. One per participant, embedded in emails.

### status_otps
`id`, `participant_id` FK, `code_hash`, `attempts`, `expires_at`, `consumed_at`, `created_at`.

### rate_limits
`key TEXT`, `window_start INTEGER`, `count INTEGER`, primary key `(key, window_start)`. Incremented with a single `INSERT … ON CONFLICT DO UPDATE … RETURNING count`. Old windows are deleted by the cron.

### idempotency_keys
`key TEXT PK`, `scope`, `response_json`, `created_at`. Kept for 24 hours.

## Relationships

```
admins 1─* admin_sessions
teams 1─* participants (1..3) 1─1 files (STUDENT_ID)
teams 1─1 idea_submissions 1─1 files (IDEA_DOC)
idea_submissions 1─* idea_reviews *─1 admins
teams 1─* shortlist_selections
teams 1─* payments 0..1─1 files (PAYMENT_SCREENSHOT)
payments 1─* payment_verification_logs
participants 1─0..1 attendance
teams 1─0..1 final_results
participants 1─* email_outbox, status_tokens, status_otps
```

## Atomic operations

D1 has no interactive transactions, so each of these is one `db.batch`:

| Operation | Statements |
| :--- | :--- |
| Register | insert idempotency key; insert team; insert participants; insert idea; attach files (`WHERE status='PENDING' AND upload_session=?`); insert status tokens; insert outbox rows |
| Finalise shortlist | update candidates to `SHORTLISTED`; update the rest to `NOT_SELECTED`; write finalised-at (guarded by `WHERE` it is unset); insert log row; insert outbox rows |
| Verify payment | update payment where still pending; update team to `CONFIRMED`; insert log; insert attendance rows; insert outbox rows |
| Publish results | insert publication row with snapshot; insert log |

After the batch the service checks affected-row counts (for example that exactly the expected files were attached) and compensates if not.

The 30-team cap is applied inside the `UPDATE` that adds a candidate: `… WHERE id = ? AND (SELECT COUNT(*) FROM teams WHERE is_shortlist_candidate = 1) < 30`, so two admins toggling at once cannot exceed it.

## Migrations and seed

- `drizzle-kit generate` writes SQL to `drizzle/migrations/`; `wrangler d1 migrations apply` runs them locally, in preview and in production.
- `scripts/seed.ts`: default settings and schedule.
- `scripts/create-admin.ts`: prompts for email and password, prints one `INSERT` to run with `wrangler d1 execute`. There is no default password and no public admin sign-up.

## Retention

Student ID images and payment screenshots are deleted 30 days after the event; participant contact details 90 days after, leaving team name, universities, idea title and result. A super admin triggers the purge; it is logged.
