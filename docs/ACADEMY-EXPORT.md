# Academy data export

What a pilot academy can take with it, how to get it, and what is not in it.
Source of truth for the format: `src/lib/academy-export.ts`.

## Getting the file (owner, self-serve)

1. Sign in on the web at `/sign-in` as the academy owner.
2. Open **Settings → Your data → Export academy data**.
3. The browser downloads `matflow-<academy-slug>-export-<YYYY-MM-DD>.json`.

Requires current owner access (trial or active plan). If the trial expired or
the subscription was canceled, the button shows that support can run an
assisted export (below). Whether locked-out owners should self-export is an
open product decision for Frank; it has not been changed.

## Support-assisted export (cancellation, lockout, very large academies)

Only platform admins (`PLATFORM_ADMIN_EMAILS`) can run it.

1. Verify the requester owns the academy: the request must come from the
   owner email on file (Members → the owner record), or be confirmed by
   replying from that address. Never export to a third party.
2. Signed in as a platform admin, open
   `/api/platform/gyms/<gymId>/export` (gym id from `/platform/gyms`).
3. Send the file privately (attach to a direct reply to the verified owner
   email, or a password-protected archive with the password sent separately).
   Never post a shared public link, never attach it to chat, and do not keep
   copies in notes, Obsidian, the repository or logs. Delete the local copy
   after delivery.

Every export writes one activity-log row (`data_exported`) with record counts
only.

## Format (schemaVersion 1)

One JSON object:

| Key | Contents |
|---|---|
| `format` | `"matflow-academy-export"` |
| `schemaVersion` | `1` |
| `exportedAt` | ISO timestamp |
| `academy` | id, name, slug, description, city, state, address, phone, website, timezone, createdAt |
| `manifest.counts` | number of rows in each array below — check these to confirm completeness |
| `manifest.relationships` | how arrays reference each other by `id` |
| `members` | roster: id, names, email, phone, academy belt/stripes, status, active, approved, location, createdAt, `hasStudentAccount` |
| `instructors` | id, name, belt, bio, optional `memberId`, active |
| `classSchedules` | weekly classes: day (0=Sun), start/end (academy-local HH:MM), type, instructor, location, active |
| `attendance` | id, `memberId`, classDate (academy-local date at UTC midnight), classType, location, checkedInAt |
| `beltProgress` | academy-verified promotion history: `memberId`, belt, stripes, note, awardedAt |
| `waiverTemplates` | every template with its CURRENT text and version |
| `waiverSignatures` | `templateId`, `memberId` or `dropInId`, the `version` signed, signer's typed name, `signedAt`, and `waiverContentSnapshot` — the exact text that was signed |
| `dropIns` | visitors referenced by drop-in signatures: names, email, phone, visit date |

The file contains personal information (member contact details, signed
waivers). Treat it as sensitive.

## Not included

Passwords and password hashes, login/identity ids, kiosk check-in codes,
Stripe ids, students' private training journals and plans, community posts,
planned-attendance commitments, other academies' data, MatFlow founder
prospect/campaign records.

## Limits

Each table is capped at 50,000 rows. Above that the self-serve export answers
413 `EXPORT_TOO_LARGE` instead of producing a truncated file; use the
support path. MatFlow does not import or restore from this file.
