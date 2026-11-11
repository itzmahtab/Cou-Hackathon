-- =========================================================
-- AI Hackathon Portal - Complete PostgreSQL Database Schema
-- Next.js (App Router) edition.
--
-- This schema is aligned with every query executed by the API route
-- handlers under /app/api. Apply it with:
--   psql "$DATABASE_URL" -f db/schema.sql
-- =========================================================

-- `gen_random_uuid()` is built into PostgreSQL 13+, so no extension is needed.

-- -------------------------------------------------------------
-- Staff Accounts (Super Admin, Moderator, Judge)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  role VARCHAR(12) NOT NULL CHECK (role IN ('super_admin','moderator','judge')),
  active BOOLEAN NOT NULL DEFAULT true,
  failed_logins INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- Teams
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name VARCHAR(60) NOT NULL,
  university VARCHAR(120) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','payment_correction','approved','rejected')),
  admin_note TEXT,
  reviewed_by UUID REFERENCES staff(id),
  reviewed_at TIMESTAMPTZ,
  is_finalist BOOLEAN NOT NULL DEFAULT false,
  finalist_set_at TIMESTAMPTZ,
  banned BOOLEAN NOT NULL DEFAULT false,
  deadline_override TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_name ON teams (lower(team_name));
CREATE INDEX IF NOT EXISTS idx_team_status ON teams (status);

-- -------------------------------------------------------------
-- Team Accounts (login credentials issued on approval)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_accounts (
  team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  login_email VARCHAR(120) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  credentials_sent BOOLEAN NOT NULL DEFAULT false,
  credentials_sent_at TIMESTAMPTZ,
  failed_logins INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- Team Members
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  is_leader BOOLEAN NOT NULL DEFAULT false,
  full_name VARCHAR(100) NOT NULL,
  student_id VARCHAR(40) NOT NULL,
  email VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  department VARCHAR(80),
  year VARCHAR(20),
  id_card_key TEXT,
  UNIQUE (team_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_members_email ON members (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_leader ON members (team_id) WHERE is_leader;

-- -------------------------------------------------------------
-- Payments (manual bKash / Nagad / Rocket verification)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  method VARCHAR(10) NOT NULL CHECK (method IN ('bkash','nagad','rocket')),
  sender_no VARCHAR(20) NOT NULL,
  trx_id VARCHAR(40) NOT NULL,
  amount NUMERIC(10,2),
  verified_by UUID REFERENCES staff(id),
  verified_at TIMESTAMPTZ,
  UNIQUE (method, trx_id)
);

-- -------------------------------------------------------------
-- One-Time Payment Correction Tokens
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS correction_tokens (
  token_hash TEXT PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  reason TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

-- -------------------------------------------------------------
-- Configuration Settings (key/value, JSONB)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES staff(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- Scenario Documents
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(120) NOT NULL,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('guideline','rulebook','problem_statement','other')),
  file_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  size_bytes BIGINT,
  visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- Online Submissions
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  abstract VARCHAR(350) NOT NULL CHECK (char_length(abstract) <= 350),
  repo_url TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- GitHub Repository Snapshots
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS repo_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
  commit_sha CHAR(40),
  branch TEXT,
  captured_at TIMESTAMPTZ,
  zip_key TEXT,
  zip_size_bytes BIGINT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','ok','failed','repo_not_public','too_large')),
  error TEXT,
  attempts INT NOT NULL DEFAULT 0
);

-- -------------------------------------------------------------
-- Reviews (Online Round, one per judge per team)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  judge_name VARCHAR(100),
  score NUMERIC(6,2) NOT NULL CHECK (score >= 0),
  comment TEXT NOT NULL DEFAULT '',
  is_final BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, judge_id)
);

-- -------------------------------------------------------------
-- On-Site Scores (Phase 2)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onsite_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  judge_name VARCHAR(100),
  score NUMERIC(6,2) NOT NULL CHECK (score >= 0),
  comment TEXT,
  is_final BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, judge_id)
);

-- -------------------------------------------------------------
-- Check-ins (Event Day Reception)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checkins (
  team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_by UUID REFERENCES staff(id),
  members_present INT
);

-- -------------------------------------------------------------
-- Final Published Results
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS final_results (
  team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  team_name VARCHAR(120),
  university VARCHAR(120),
  online_avg NUMERIC(6,2),
  onsite_avg NUMERIC(6,2),
  final_score NUMERIC(6,2),
  rank INT,
  prize_label VARCHAR(60),
  published BOOLEAN NOT NULL DEFAULT false
);

-- -------------------------------------------------------------
-- Audit Trail
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type VARCHAR(20),
  actor_id TEXT,
  actor_name VARCHAR(150),
  action TEXT NOT NULL,
  target_type VARCHAR(40),
  target_id TEXT,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);

-- -------------------------------------------------------------
-- Bootstrap super admin
-- -------------------------------------------------------------
INSERT INTO staff (id, name, email, password_hash, must_change_password, role, active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Super Admin CoU',
  'admin@cou.ac.bd',
  '$2b$12$ihLItXLm3aczWgXeJLDvOuV54DmPsMdDo3QPsnAHR97YWGihQZqPO',
  false,
  'super_admin',
  true
) ON CONFLICT (email) DO NOTHING;
