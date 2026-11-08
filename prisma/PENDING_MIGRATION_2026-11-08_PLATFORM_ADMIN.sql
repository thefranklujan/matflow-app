-- MatFlow pending schema migration (additive, non-destructive), 2026-11-08.
-- Phase 0 security hotfix, item C1: platform admin comes from a server-side
-- flag on a Member row, never from the session email.
--
-- ORDER MATTERS. Apply this BEFORE the hotfix deploys: the new Prisma client
-- selects "isPlatformAdmin" on every Member read, so code without the column
-- in the database fails every query that touches Member. The column is
-- additive with a default, so the currently deployed code is unaffected by it.
--
-- Apply (production only on Frank's go, Lane B rollout record):
--   psql "$DIRECT_URL" -f prisma/PENDING_MIGRATION_2026-11-08_PLATFORM_ADMIN.sql
-- Do NOT use `prisma db push` against production for this step: it reconciles the
-- whole schema (the production schema has no migration history) instead of adding
-- one column.
-- Then run: node scripts/backfill-platform-admins.mjs  (dry run first, then --apply --ids=...)

ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;
