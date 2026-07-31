/**
 * Sandbox run manifest.
 *
 * Records what a lifecycle run created and how far it got, so a run can be
 * resumed after an interruption and so cleanup knows exactly what it owns.
 *
 * Two rules shape the format:
 *
 *   - Reports quote ALIASES (`basic_price`, `test_customer_1`), never Stripe
 *     ids. The id lives only in the git-ignored manifest file; the alias is
 *     what appears in any human-readable output.
 *   - A stage is only resumable when it PASSED. Anything else re-runs, because
 *     a partially-applied stage is not a completed one.
 */

export type StageStatus = "passed" | "failed" | "partial" | "manual" | "blocked" | "skipped";

export interface StageRecord {
  id: string;
  order: number;
  status: StageStatus;
  /** Human-readable, alias-only. Never contains a Stripe id. */
  detail: string;
  /** What was observed in Stripe. Alias-only. */
  stripeObserved?: string;
  /** What was observed in the local application/database. */
  localObserved?: string;
}

export interface ObjectRecord {
  alias: string;
  kind: "product" | "price" | "customer" | "subscription" | "checkout_session" | "portal_configuration" | "test_clock" | "gym";
  id: string;
  /** Whether cleanup should remove this at the end of the run. */
  disposable: boolean;
  cleanedUp?: boolean;
}

export interface RunManifest {
  version: 1;
  /** Label for this run; appears in generated test identities. */
  runLabel: string;
  /** Fingerprint of the sandbox this run is bound to. */
  sandboxFingerprint: string;
  stages: StageRecord[];
  objects: ObjectRecord[];
}

export function emptyManifest(runLabel: string, sandboxFingerprint: string): RunManifest {
  return { version: 1, runLabel, sandboxFingerprint, stages: [], objects: [] };
}

/** Record (or overwrite) a stage result. Later runs replace earlier attempts. */
export function recordStage(manifest: RunManifest, record: StageRecord): RunManifest {
  const stages = manifest.stages.filter((s) => s.id !== record.id);
  stages.push(record);
  stages.sort((a, b) => a.order - b.order);
  return { ...manifest, stages };
}

export function recordObject(manifest: RunManifest, record: ObjectRecord): RunManifest {
  const objects = manifest.objects.filter((o) => o.alias !== record.alias);
  objects.push(record);
  return { ...manifest, objects };
}

/** Only a passed stage may be skipped on resume. */
export function isResumable(manifest: RunManifest, stageId: string): boolean {
  return manifest.stages.find((s) => s.id === stageId)?.status === "passed";
}

/**
 * A run is only Verified when EVERY stage passed.
 *
 * Deliberately strict: partial, manual, blocked, and skipped all mean the
 * lifecycle was not proven end to end, and none of them may be reported as a
 * verified Stripe lifecycle.
 */
export function isFullyVerified(manifest: RunManifest, expectedStageIds: readonly string[]): boolean {
  if (expectedStageIds.length === 0) return false;
  return expectedStageIds.every((id) => manifest.stages.find((s) => s.id === id)?.status === "passed");
}

export function summarize(manifest: RunManifest, expectedStageIds: readonly string[]): Record<StageStatus | "missing", number> {
  const counts = { passed: 0, failed: 0, partial: 0, manual: 0, blocked: 0, skipped: 0, missing: 0 } as Record<StageStatus | "missing", number>;
  for (const id of expectedStageIds) {
    const found = manifest.stages.find((s) => s.id === id);
    if (!found) counts.missing += 1;
    else counts[found.status] += 1;
  }
  return counts;
}

/** Objects still awaiting cleanup. */
export function pendingCleanup(manifest: RunManifest): ObjectRecord[] {
  return manifest.objects.filter((o) => o.disposable && !o.cleanedUp);
}

/**
 * Redact a manifest for reporting: aliases and statuses only.
 *
 * This is what may appear in a report or a log. The Stripe ids never leave the
 * git-ignored file.
 */
export function redactForReport(manifest: RunManifest): {
  runLabel: string;
  stages: Array<Omit<StageRecord, never>>;
  objects: Array<{ alias: string; kind: ObjectRecord["kind"]; disposable: boolean; cleanedUp: boolean }>;
} {
  return {
    runLabel: manifest.runLabel,
    stages: manifest.stages,
    objects: manifest.objects.map((o) => ({
      alias: o.alias,
      kind: o.kind,
      disposable: o.disposable,
      cleanedUp: o.cleanedUp === true,
    })),
  };
}
