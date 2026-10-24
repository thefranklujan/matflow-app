# Proposed schema changes (design only — NOT applied)

From the academy-readiness branch. Nothing here has been migrated, pushed with
`db push`, or made a dependency of shipped code: every packet works on the
current schema. Each item needs Frank's approval before a migration is written.

## 1. Durable community ↔ academy link (Packet A)

**Today:** a student community (`GymGroup`) and an academy (`Gym`) are related
only by name. The destructive auto-claim is gone; same-name communities stay
intact and show "Pending review".

**Proposal:** `GymGroup.gymId String?` (FK → Gym, `onDelete: SetNull`), plus
`linkedAt`, `linkedBy`. The founder claim sets it inside the existing claim
transaction; the student gyms page then shows a linked community under its
academy instead of "Pending review".

- Migration: additive nullable column + index. No backfill (links are created
  only by a deliberate founder action).
- Rollback: drop the column; behavior returns to today's name-only display.
- Alternative: keep name-only forever (current state) — safe but the pending
  label never resolves.

## 2. Database-level waiver signature uniqueness (Packet B)

**Today:** a per-template advisory lock serializes signing and editing, which
the real-Postgres tests prove for concurrent submissions.

**Proposal:** partial unique index
`CREATE UNIQUE INDEX waiver_sig_member_version ON "WaiverSignature"("templateId","memberId","version") WHERE "memberId" IS NOT NULL;`

- Pre-check: count existing duplicates first; if any exist, keep every row
  (they are legal history) and exclude them from the index via a one-off
  review, never by deletion.
- Rollback: drop the index.

## 3. Commitment → schedule reference (Packet D)

**Today:** commitments are identified by `classType@HH:MM` + location + local
date; legacy raw types resolve only when unambiguous.

**Proposal:** `ScheduleCommitment.scheduleId String?` (FK → ClassSchedule,
`onDelete: SetNull`) and a unique `(gymId, memberId, scheduleId, classDate)`.
Writers set it; readers prefer it and fall back to today's contract.

- Backfill: for each row, run the existing `resolveCommitment`; set
  `scheduleId` only for `resolved`; leave `ambiguous`/`unmatched` null and
  report counts. Dry-run first, transactional, idempotent.
- Rollback: drop column/index; today's contract keeps working.
- Also lets a reschedule notify the people who had planned to attend.

## 4. Reminder dispatch ledger (Packet D)

**Today:** duplicate suppression uses Notification inbox rows (kind
`class_reminder`, occurrence-unique url) under an advisory lock.

**Proposal:** `ReminderDispatch { id, scheduleId, classDate, externalId,
createdAt, providerStatus }` with unique `(scheduleId, classDate, externalId)`,
so dedup does not depend on inbox rows (which users could one day delete) and
provider outcomes can be recorded. Additive; rollback = drop table.

## 5. Per-category notification preferences

**Today:** only device-level push opt-out (enforced by the provider). The
reminder job cannot honor "no class reminders" separately.

**Proposal:** `NotificationPreference { externalId, kind, enabled }` (unique
`(externalId, kind)`), checked by `notify()` and the reminder job. Additive.

## Not schema, but still decisions for Frank

- **Locked-out owner self-export.** Owners currently need active owner access
  to export; after cancellation, support runs the assisted export. Allowing
  self-export after lockout is a post-cancellation authorization change.
- **Vercel runtime.** CI and `.nvmrc` now use Node 22. The Vercel project's
  Node setting was not inspected or changed; Node 20 is deprecated on Vercel
  from Oct 1, 2026.
- **Kiosk.** The kiosk route consumes check-in codes, but nothing issues them.
  Either build issuance/recovery/class attribution or keep it out of the offer.
