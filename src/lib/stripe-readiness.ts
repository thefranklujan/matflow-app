/**
 * Stripe test-mode configuration preflight.
 *
 * Pure and offline: it inspects configuration SHAPE only. It never calls
 * Stripe, never reads Vercel, never prints a value or a fragment of one, and
 * refuses outright if a live secret key is present.
 */

export const EXIT_OK = 0;
export const EXIT_INCOMPLETE = 1;
/** Distinct, unmistakable code: a live key was detected. */
export const EXIT_LIVE_KEY_REFUSED = 87;
/** A forbidden environment file was requested (for example .env.production). */
export const EXIT_FORBIDDEN_FILE = 88;

export type KeyMode = "missing" | "test" | "live" | "unrecognized";
export type UrlKind = "missing" | "localhost" | "preview" | "production";

export interface ReadinessInput {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_BASIC_PRICE_ID?: string;
  STRIPE_PRO_PRICE_ID?: string;
  NEXT_PUBLIC_APP_URL?: string;
}

export interface ReadinessReport {
  secretKeyMode: KeyMode;
  webhookSecretPresent: boolean;
  basicPricePresent: boolean;
  proPricePresent: boolean;
  pricesDistinct: boolean;
  appUrl: UrlKind;
  stripeCliPresent: boolean;
  ready: boolean;
  exitCode: number;
  problems: string[];
}

/**
 * Values that are structurally present but obviously not filled in.
 *
 * .env.stripe-test is created from the example template, so a half-configured
 * file is the NORMAL intermediate state, not an exotic one. Treating
 * `sk_test_REPLACE_ME` as a real key made the gate pass with exit 0 and print
 * "ready", which is exactly the fail-open this tooling exists to prevent.
 */
const PLACEHOLDER_PATTERNS = [/REPLACE_ME/i, /USER:PASSWORD/i];

export function isPlaceholder(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(value));
}

/** Present means filled in. A template placeholder is not filled in. */
function present(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0 && !isPlaceholder(value);
}

/** Which of the supplied keys still hold template placeholders. */
export function unfilledPlaceholderKeys(env: Record<string, string | undefined>): string[] {
  return Object.entries(env)
    .filter(([, v]) => isPlaceholder(v))
    .map(([k]) => k)
    .sort();
}

export function classifySecretKey(value: string | undefined): KeyMode {
  if (!present(value)) return "missing";
  const v = value!.trim();
  // Secret and restricted keys, both modes.
  if (/^(sk|rk)_test_/.test(v)) return "test";
  if (/^(sk|rk)_live_/.test(v)) return "live";
  return "unrecognized";
}

export function classifyAppUrl(value: string | undefined): UrlKind {
  if (!present(value)) return "missing";
  const v = value!.trim().toLowerCase();
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/.test(v)) return "localhost";
  if (v.includes("vercel.app") || v.includes("-preview") || v.includes("staging")) return "preview";
  return "production";
}

/** Files this preflight must never load. */
export function isForbiddenEnvFile(path: string): boolean {
  const name = path.split("/").pop() ?? path;
  return /^\.env\.production(\..*)?$/.test(name) || name === ".env.prod";
}

export function evaluateReadiness(env: ReadinessInput, opts: { stripeCliPresent: boolean }): ReadinessReport {
  const secretKeyMode = classifySecretKey(env.STRIPE_SECRET_KEY);
  const webhookSecretPresent = present(env.STRIPE_WEBHOOK_SECRET);
  const basicPricePresent = present(env.STRIPE_BASIC_PRICE_ID);
  const proPricePresent = present(env.STRIPE_PRO_PRICE_ID);
  const pricesDistinct =
    basicPricePresent && proPricePresent
      ? env.STRIPE_BASIC_PRICE_ID!.trim() !== env.STRIPE_PRO_PRICE_ID!.trim()
      : false;
  const appUrl = classifyAppUrl(env.NEXT_PUBLIC_APP_URL);

  const problems: string[] = [];

  // A live key is an immediate, non-negotiable refusal.
  if (secretKeyMode === "live") {
    return {
      secretKeyMode,
      webhookSecretPresent,
      basicPricePresent,
      proPricePresent,
      pricesDistinct,
      appUrl,
      stripeCliPresent: opts.stripeCliPresent,
      ready: false,
      exitCode: EXIT_LIVE_KEY_REFUSED,
      problems: ["A LIVE Stripe secret key is configured. This tooling refuses to run against live mode."],
    };
  }

  if (secretKeyMode === "missing") problems.push("STRIPE_SECRET_KEY is missing (need a test-mode sk_test_/rk_test_ key).");
  if (secretKeyMode === "unrecognized") problems.push("STRIPE_SECRET_KEY is not a recognizable Stripe key.");
  if (!webhookSecretPresent) problems.push("STRIPE_WEBHOOK_SECRET is missing (needed to verify signed webhooks).");
  if (!basicPricePresent) problems.push("STRIPE_BASIC_PRICE_ID is missing.");
  if (!proPricePresent) problems.push("STRIPE_PRO_PRICE_ID is missing.");
  if (basicPricePresent && proPricePresent && !pricesDistinct) {
    problems.push("Basic and Pro price IDs are identical — plan switching cannot be tested.");
  }
  if (appUrl === "missing") problems.push("NEXT_PUBLIC_APP_URL is missing.");
  if (appUrl === "production") problems.push("NEXT_PUBLIC_APP_URL looks like production; use localhost or a preview URL.");
  if (!opts.stripeCliPresent) problems.push("Stripe CLI not found (needed to forward and replay test webhooks).");

  const ready = problems.length === 0 && secretKeyMode === "test";
  return {
    secretKeyMode,
    webhookSecretPresent,
    basicPricePresent,
    proPricePresent,
    pricesDistinct,
    appUrl,
    stripeCliPresent: opts.stripeCliPresent,
    ready,
    exitCode: ready ? EXIT_OK : EXIT_INCOMPLETE,
    problems,
  };
}

/** Human-readable status. Contains no values, only classifications. */
export function formatReport(report: ReadinessReport): string {
  const yes = (b: boolean) => (b ? "present" : "MISSING");
  const lines = [
    "MatFlow Stripe test-mode readiness (configuration shape only — no values printed)",
    "",
    `  Secret key mode ......... ${report.secretKeyMode}`,
    `  Webhook secret .......... ${yes(report.webhookSecretPresent)}`,
    `  Basic price ID .......... ${yes(report.basicPricePresent)}`,
    `  Pro price ID ............ ${yes(report.proPricePresent)}`,
    `  Prices distinct ......... ${report.pricesDistinct ? "yes" : "no"}`,
    `  App URL ................. ${report.appUrl}`,
    `  Stripe CLI .............. ${yes(report.stripeCliPresent)}`,
    "",
    report.ready ? "  READY: complete test-mode configuration." : "  NOT READY:",
  ];
  for (const problem of report.problems) lines.push(`    - ${problem}`);
  return lines.join("\n");
}
