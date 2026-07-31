import { describe, it, expect } from "vitest";
import {
  emptyManifest,
  isFullyVerified,
  isResumable,
  pendingCleanup,
  recordObject,
  recordStage,
  redactForReport,
  summarize,
  type StageStatus,
} from "./stripe-manifest";

const FP = "0123456789abcdef0123456789abcdef";
const base = () => emptyManifest("gate1", FP);

const stage = (id: string, order: number, status: StageStatus) => ({ id, order, status, detail: `${id} ${status}` });

describe("recordStage", () => {
  it("keeps stages ordered regardless of insertion order", () => {
    let m = base();
    m = recordStage(m, stage("c", 3, "passed"));
    m = recordStage(m, stage("a", 1, "passed"));
    m = recordStage(m, stage("b", 2, "failed"));
    expect(m.stages.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("a re-run replaces the earlier attempt rather than duplicating it", () => {
    let m = recordStage(base(), stage("a", 1, "failed"));
    m = recordStage(m, stage("a", 1, "passed"));
    expect(m.stages).toHaveLength(1);
    expect(m.stages[0].status).toBe("passed");
  });
});

describe("isResumable — only a passed stage may be skipped", () => {
  it("passed stages resume", () => {
    expect(isResumable(recordStage(base(), stage("a", 1, "passed")), "a")).toBe(true);
  });

  it("every non-passed outcome re-runs", () => {
    for (const status of ["failed", "partial", "manual", "blocked", "skipped"] as StageStatus[]) {
      expect(isResumable(recordStage(base(), stage("a", 1, status)), "a"), status).toBe(false);
    }
  });

  it("an unrecorded stage re-runs", () => {
    expect(isResumable(base(), "never_ran")).toBe(false);
  });
});

describe("isFullyVerified is deliberately strict", () => {
  const expected = ["a", "b"] as const;

  it("true only when every expected stage passed", () => {
    let m = recordStage(base(), stage("a", 1, "passed"));
    m = recordStage(m, stage("b", 2, "passed"));
    expect(isFullyVerified(m, expected)).toBe(true);
  });

  it("a manual or partial stage does NOT count as verified", () => {
    for (const status of ["partial", "manual", "blocked", "skipped", "failed"] as StageStatus[]) {
      let m = recordStage(base(), stage("a", 1, "passed"));
      m = recordStage(m, stage("b", 2, status));
      expect(isFullyVerified(m, expected), status).toBe(false);
    }
  });

  it("a missing stage does not count as verified", () => {
    expect(isFullyVerified(recordStage(base(), stage("a", 1, "passed")), expected)).toBe(false);
  });

  it("an empty run is never verified", () => {
    expect(isFullyVerified(base(), expected)).toBe(false);
    expect(isFullyVerified(base(), [])).toBe(false);
  });
});

describe("summarize", () => {
  it("counts every expected stage, including ones that never ran", () => {
    let m = recordStage(base(), stage("a", 1, "passed"));
    m = recordStage(m, stage("b", 2, "failed"));
    const counts = summarize(m, ["a", "b", "c"]);
    expect(counts).toMatchObject({ passed: 1, failed: 1, missing: 1 });
  });
});

describe("object tracking and cleanup", () => {
  it("lists only disposable, not-yet-cleaned objects", () => {
    let m = recordObject(base(), { alias: "basic_price", kind: "price", id: "price_X", disposable: false });
    m = recordObject(m, { alias: "test_customer_1", kind: "customer", id: "cus_X", disposable: true });
    m = recordObject(m, { alias: "test_customer_2", kind: "customer", id: "cus_Y", disposable: true, cleanedUp: true });

    expect(pendingCleanup(m).map((o) => o.alias)).toEqual(["test_customer_1"]);
  });

  it("re-recording an alias updates it rather than duplicating", () => {
    let m = recordObject(base(), { alias: "test_customer_1", kind: "customer", id: "cus_X", disposable: true });
    m = recordObject(m, { alias: "test_customer_1", kind: "customer", id: "cus_X", disposable: true, cleanedUp: true });
    expect(m.objects).toHaveLength(1);
    expect(pendingCleanup(m)).toEqual([]);
  });

  // The reusable catalog must survive so the next run does not create duplicates.
  it("catalog objects are not disposable", () => {
    const m = recordObject(base(), { alias: "basic_price", kind: "price", id: "price_X", disposable: false });
    expect(pendingCleanup(m)).toEqual([]);
  });
});

describe("redactForReport never exposes Stripe identifiers", () => {
  it("strips ids while keeping aliases and outcomes", () => {
    let m = recordStage(base(), stage("a", 1, "passed"));
    m = recordObject(m, { alias: "basic_price", kind: "price", id: "price_SECRET", disposable: false });
    m = recordObject(m, { alias: "test_customer_1", kind: "customer", id: "cus_SECRET", disposable: true });

    const report = redactForReport(m);
    const json = JSON.stringify(report);
    expect(json).not.toContain("price_SECRET");
    expect(json).not.toContain("cus_SECRET");
    expect(json).toContain("basic_price");
    expect(json).toContain("test_customer_1");
    expect(report.stages[0].status).toBe("passed");
  });

  it("reports cleanup state as a definite boolean", () => {
    const m = recordObject(base(), { alias: "x", kind: "customer", id: "cus_1", disposable: true });
    expect(redactForReport(m).objects[0].cleanedUp).toBe(false);
  });
});
