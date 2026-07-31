/**
 * Sandbox identity guard.
 *
 * Every mutating Stripe operation in this repository must prove it is talking
 * to the one approved sandbox before it does anything. The mechanism is a
 * one-way fingerprint: the approved account identifier is hashed once and only
 * the hash is stored, so the guard can recognise the right account without any
 * file, log, or report ever containing the identifier itself.
 *
 * This exists because the machine's default Stripe CLI profile is authenticated
 * to a LIVE-capable account. "I meant to be in test mode" is not a safety
 * property; a positive identity check is.
 */

import { createHash } from "node:crypto";

/** The sandbox this repository is allowed to mutate. */
export const APPROVED_SANDBOX_NAME = "MatFlow Billing QA";

/**
 * One-way fingerprint of an account identifier.
 *
 * Salted with a fixed, non-secret domain string so the digest is only
 * meaningful to this tool and cannot be compared against a rainbow table of
 * bare Stripe account ids.
 */
export function fingerprintAccount(accountId: string): string {
  return createHash("sha256").update(`matflow-sandbox-guard:v1:${accountId.trim()}`).digest("hex").slice(0, 32);
}

export type SandboxVerdict =
  | "approved"
  /** No fingerprint recorded yet: the sandbox has never been approved here. */
  | "unpinned"
  /** A fingerprint is recorded and this account is not it. */
  | "mismatch"
  /** The account id is missing or unusable. */
  | "unknown";

export interface SandboxCheck {
  verdict: SandboxVerdict;
  allowed: boolean;
  message: string;
}

/**
 * Decide whether the current Stripe context may be mutated.
 *
 * Fails closed in every ambiguous case. Note that "unpinned" is NOT allowed:
 * an unrecorded fingerprint means nobody has ever confirmed which account this
 * is, which is exactly when a mistake is most likely.
 */
export function checkSandbox(currentAccountId: string | undefined, pinnedFingerprint: string | undefined): SandboxCheck {
  if (!currentAccountId || currentAccountId.trim() === "") {
    return {
      verdict: "unknown",
      allowed: false,
      message: "The current Stripe account could not be determined. Refusing to act.",
    };
  }
  if (!pinnedFingerprint || pinnedFingerprint.trim() === "") {
    return {
      verdict: "unpinned",
      allowed: false,
      message: `No approved sandbox is pinned. Authenticate to the "${APPROVED_SANDBOX_NAME}" sandbox and record its fingerprint first.`,
    };
  }
  if (fingerprintAccount(currentAccountId) !== pinnedFingerprint.trim()) {
    return {
      verdict: "mismatch",
      allowed: false,
      message: `The current Stripe account is not the approved "${APPROVED_SANDBOX_NAME}" sandbox. Refusing to act.`,
    };
  }
  return {
    verdict: "approved",
    allowed: true,
    message: `Verified: the approved "${APPROVED_SANDBOX_NAME}" sandbox.`,
  };
}

/**
 * A live account id is refused outright, ahead of any fingerprint comparison.
 *
 * Stripe sandbox accounts are addressed with the parent account id, so this
 * cannot distinguish sandbox from live on its own — that is precisely why the
 * fingerprint above is required as well. This is a cheap extra tripwire, not
 * the primary control.
 */
export function isPlausibleAccountId(accountId: string | undefined): boolean {
  return typeof accountId === "string" && /^acct_[A-Za-z0-9]+$/.test(accountId.trim());
}
