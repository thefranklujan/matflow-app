import { notFound } from "next/navigation";

/**
 * The kiosk is off until check-in codes are issued: nothing writes
 * Member.checkinCode, so every code was "Invalid" (owner-features finding 12).
 * The previous keypad lives in git history (before the Phase 0 hotfix).
 */
export default function KioskPage(): never {
  notFound();
}
