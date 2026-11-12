#!/usr/bin/env bash
# Recreates the local D1 database with one super admin for the browser tests.
# Stop `next dev` first. Usage: tests/e2e/reset-local.sh <admin-email> <admin-password>
set -euo pipefail
cd "$(dirname "$0")/../.."
rm -rf .wrangler/state
pnpm exec wrangler d1 migrations apply cou-hackathon --local >/dev/null
hash=$(printf '%s' "$2" | pnpm exec tsx scripts/hash-password.ts)
now=$(date +%s000)
pnpm exec wrangler d1 execute cou-hackathon --local --command "INSERT INTO admins (id,email,name,password_hash,role,is_active,must_change_password,created_at,updated_at) VALUES ('$(cat /proc/sys/kernel/random/uuid)','$1','Local Admin','$hash','SUPER_ADMIN',1,0,$now,$now)" >/dev/null
echo "Local database reset with super admin $1"
