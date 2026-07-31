/**
 * Stripe test-mode lifecycle harness — planning and guard logic.
 *
 * This module is pure. It decides WHAT the lifecycle would do and WHETHER it is
 * safe to do it. It never imports the Stripe SDK, never opens a network
 * connection, and never touches a database. The runner
 * (`scripts/stripe-lifecycle.mjs`) is dry-run by default and may only mutate
 * anything when an explicit `--execute-test-mode` flag is passed AND every
 * guard below returns "allowed".
 *
 * Design rule: the harness never creates Stripe products or prices. Prices are
 * created once by a human in the Stripe Dashboard and supplied by id. A tool
 * that can invent prices can silently invent an offer, and the published offer
 * ($49 Basic / $99 Pro) is a business decision, not a test fixture.
 */

import { classifyAppUrl, classifySecretKey, type KeyMode, type UrlKind } from "./stripe-readiness";
import stageData from "./stripe-lifecycle-stages.json";

export const EXIT_OK = 0;
export const EXIT_REFUSED = 1;
/** A live-mode credential was present. Deliberately distinct and loud. */
export const EXIT_LIVE_REFUSED = 87;

/** Domain of an email address that can never reach a real person. */
export const TEST_IDENTITY_DOMAIN = "stripe-test.matflow.test";

export type StageKind = "read" | "mutate" | "assert";

export interface LifecycleStage {
  /** 1-based position. Stages always run in this order. */
  order: number;
  id: string;
  title: string;
  kind: StageKind;
  /** What the stage proves. Printed in dry-run output. */
  proves: string;
}

/**
 * The twenty stages of a complete test-mode subscription lifecycle, in order.
 * Each mutating stage is paired with an assertion so a green run cannot mean
 * "the call did not throw" — it must mean "the observable state changed".
 *
 * The stage list lives in stripe-lifecycle-stages.json so this module and the
 * dependency-free CLI runner read the SAME bytes. Node 20 cannot import
 * TypeScript, and a hand-copied second list would drift silently.
 */
export const LIFECYCLE_STAGES: readonly LifecycleStage[] = stageData as LifecycleStage[];

export type RefusalCode =
  | "LIVE_KEY"
  | "LIVE_WEBHOOK_TARGET"
  | "PRODUCTION_APP_URL"
  | "PRODUCTION_DATABASE"
  | "MISSING_WEBHOOK_SECRET"
  | "MISSING_PRICE_IDS"
  | "IDENTICAL_PRICE_IDS"
  | "NOT_A_TEST_KEY";

export interface LifecycleEnv {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_BASIC_PRICE_ID?: string;
  STRIPE_PRO_PRICE_ID?: string;
  NEXT_PUBLIC_APP_URL?: string;
  /** The database the harness would mutate. Must be local. */
  E2E_DATABASE_URL?: string;
}

export interface Refusal {
  code: RefusalCode;
  message: string;
}

export interface LifecyclePlan {
  mode: "dry-run" | "execute";
  secretKeyMode: KeyMode;
  appUrl: UrlKind;
  databaseIsLocal: boolean;
  refusals: Refusal[];
  allowed: boolean;
  exitCode: number;
  stages: readonly LifecycleStage[];
}

function present(v: string | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * A database host is acceptable only when it is unmistakably local. Anything
 * unparseable is treated as remote: an unreadable URL is not evidence of
 * safety.
 */
export function isLocalDatabaseUrl(value: string | undefined): boolean {
  if (!present(value)) return false;
  let host: string;
  try {
    host = new URL(value!.trim()).hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

/** Deterministic, obviously-fake identity. Never a real inbox or phone. */
export function testIdentity(runLabel: string, index = 1): { email: string; academyName: string } {
  const safe = runLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return {
    email: `owner-${safe}-${index}@${TEST_IDENTITY_DOMAIN}`,
    academyName: `Stripe Test Academy ${safe}-${index}`,
  };
}

/**
 * Decide whether the lifecycle may run, and in which mode.
 *
 * Fail closed: every problem is collected, `allowed` is true only when there
 * are none, and a live key short-circuits everything with its own exit code.
 */
export function planLifecycle(env: LifecycleEnv, opts: { execute: boolean }): LifecyclePlan {
  const secretKeyMode = classifySecretKey(env.STRIPE_SECRET_KEY);
  const appUrl = classifyAppUrl(env.NEXT_PUBLIC_APP_URL);
  const databaseIsLocal = isLocalDatabaseUrl(env.E2E_DATABASE_URL);
  const mode: "dry-run" | "execute" = opts.execute ? "execute" : "dry-run";

  if (secretKeyMode === "live") {
    return {
      mode,
      secretKeyMode,
      appUrl,
      databaseIsLocal,
      refusals: [{ code: "LIVE_KEY", message: "A LIVE Stripe secret key is configured. This harness never runs against live mode." }],
      allowed: false,
      exitCode: EXIT_LIVE_REFUSED,
      stages: LIFECYCLE_STAGES,
    };
  }

  const refusals: Refusal[] = [];
  if (secretKeyMode !== "test") {
    refusals.push({ code: "NOT_A_TEST_KEY", message: `STRIPE_SECRET_KEY is ${secretKeyMode}; a test-mode key is required.` });
  }
  if (!present(env.STRIPE_WEBHOOK_SECRET)) {
    refusals.push({ code: "MISSING_WEBHOOK_SECRET", message: "STRIPE_WEBHOOK_SECRET is missing; webhook signatures could not be verified." });
  }
  if (!present(env.STRIPE_BASIC_PRICE_ID) || !present(env.STRIPE_PRO_PRICE_ID)) {
    refusals.push({ code: "MISSING_PRICE_IDS", message: "Both STRIPE_BASIC_PRICE_ID and STRIPE_PRO_PRICE_ID are required; the harness never creates prices." });
  } else if (env.STRIPE_BASIC_PRICE_ID!.trim() === env.STRIPE_PRO_PRICE_ID!.trim()) {
    refusals.push({ code: "IDENTICAL_PRICE_IDS", message: "Basic and Pro price IDs are identical; the plan-switch stages would prove nothing." });
  }
  if (appUrl === "production") {
    refusals.push({ code: "PRODUCTION_APP_URL", message: "NEXT_PUBLIC_APP_URL points at production; webhooks would be delivered to real customers' app." });
  }
  if (!databaseIsLocal) {
    refusals.push({ code: "PRODUCTION_DATABASE", message: "E2E_DATABASE_URL is missing or not a localhost database; the harness only mutates the isolated test database." });
  }

  const allowed = refusals.length === 0;
  return {
    mode,
    secretKeyMode,
    appUrl,
    databaseIsLocal,
    refusals,
    allowed,
    exitCode: allowed ? EXIT_OK : EXIT_REFUSED,
    stages: LIFECYCLE_STAGES,
  };
}

/** Human-readable plan. Contains classifications and stage names, never values. */
export function formatPlan(plan: LifecyclePlan): string {
  const lines = [
    `MatFlow Stripe lifecycle — ${plan.mode.toUpperCase()} (no values printed)`,
    "",
    `  Secret key mode ......... ${plan.secretKeyMode}`,
    `  App URL ................. ${plan.appUrl}`,
    `  Test database is local .. ${plan.databaseIsLocal ? "yes" : "no"}`,
    "",
  ];

  if (plan.refusals.length > 0) {
    lines.push("  REFUSED:");
    for (const r of plan.refusals) lines.push(`    - [${r.code}] ${r.message}`);
    lines.push("");
  }

  lines.push(`  Stages (${plan.stages.length}):`);
  for (const stage of plan.stages) {
    const tag = stage.kind.toUpperCase().padEnd(6);
    lines.push(`    ${String(stage.order).padStart(2, " ")}. [${tag}] ${stage.title}`);
    lines.push(`        proves: ${stage.proves}`);
  }
  lines.push("");
  lines.push(
    plan.mode === "dry-run"
      ? "  Dry run: nothing was created, modified, or deleted. Pass --execute-test-mode to run for real."
      : plan.allowed
        ? "  Execution permitted by guards."
        : "  Execution BLOCKED by the refusals above.",
  );
  return lines.join("\n");
}
