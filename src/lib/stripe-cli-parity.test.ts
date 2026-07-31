/**
 * The two Stripe CLI runners are dependency-free .mjs files, so they carry
 * their own copy of the guard logic (Node 20 cannot import TypeScript). These
 * tests spawn the REAL scripts and assert they agree with the TypeScript
 * modules, so the copies cannot drift apart unnoticed.
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { evaluateReadiness } from "./stripe-readiness";
import { LIFECYCLE_STAGES, planLifecycle, type LifecycleEnv } from "./stripe-lifecycle";

const REPO_ROOT = path.resolve(__dirname, "../..");
const READINESS = path.join(REPO_ROOT, "scripts/stripe-readiness.mjs");
const LIFECYCLE = path.join(REPO_ROOT, "scripts/stripe-lifecycle.mjs");

/** Fake shapes only. */
const CASES: Record<string, LifecycleEnv> = {
  complete: {
    STRIPE_SECRET_KEY: "sk_test_FAKE",
    STRIPE_WEBHOOK_SECRET: "whsec_FAKE",
    STRIPE_BASIC_PRICE_ID: "price_basic_FAKE",
    STRIPE_PRO_PRICE_ID: "price_pro_FAKE",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    E2E_DATABASE_URL: "postgresql://matflow:matflow@localhost:5544/matflow_test",
  },
  live_key: { STRIPE_SECRET_KEY: "sk_live_FAKE" },
  empty: {},
  identical_prices: {
    STRIPE_SECRET_KEY: "sk_test_FAKE",
    STRIPE_WEBHOOK_SECRET: "whsec_FAKE",
    STRIPE_BASIC_PRICE_ID: "price_same_FAKE",
    STRIPE_PRO_PRICE_ID: "price_same_FAKE",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    E2E_DATABASE_URL: "postgresql://matflow:matflow@localhost:5544/matflow_test",
  },
  production_url: {
    STRIPE_SECRET_KEY: "sk_test_FAKE",
    STRIPE_WEBHOOK_SECRET: "whsec_FAKE",
    STRIPE_BASIC_PRICE_ID: "price_basic_FAKE",
    STRIPE_PRO_PRICE_ID: "price_pro_FAKE",
    NEXT_PUBLIC_APP_URL: "https://app.mymatflow.com",
    E2E_DATABASE_URL: "postgresql://matflow:matflow@localhost:5544/matflow_test",
  },
  remote_database: {
    STRIPE_SECRET_KEY: "sk_test_FAKE",
    STRIPE_WEBHOOK_SECRET: "whsec_FAKE",
    STRIPE_BASIC_PRICE_ID: "price_basic_FAKE",
    STRIPE_PRO_PRICE_ID: "price_pro_FAKE",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    E2E_DATABASE_URL: "postgresql://u:p@db.prod.example.com:5432/matflow",
  },
};

function withEnvFile<T>(env: LifecycleEnv, fn: (file: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "matflow-cli-parity-"));
  const file = path.join(dir, ".env.stripe-test");
  fs.writeFileSync(file, Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  try {
    return fn(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function run(script: string, args: string[]) {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", cwd: REPO_ROOT });
  return { status: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
}

describe("stripe-readiness.mjs matches the TypeScript module", () => {
  for (const [name, env] of Object.entries(CASES)) {
    it(`agrees on exit code for: ${name}`, () => {
      const expected = evaluateReadiness(env, { stripeCliPresent: true });
      const actual = withEnvFile(env, (file) => run(READINESS, ["--config", file]));
      // The script probes for the real Stripe CLI. Compare only when that
      // probe cannot change the verdict.
      if (expected.exitCode !== 0) {
        expect(actual.status, actual.out).toBe(expected.exitCode);
      } else {
        expect([0, 1]).toContain(actual.status);
      }
    });
  }

  it("refuses .env.production with exit 88 without reading it", () => {
    expect(run(READINESS, ["--config", ".env.production"]).status).toBe(88);
    expect(run(READINESS, ["--config", ".env.prod"]).status).toBe(88);
  });

  it("never prints a live key fragment", () => {
    const out = withEnvFile({ STRIPE_SECRET_KEY: "sk_live_SUPERSECRET" }, (f) => run(READINESS, ["--config", f])).out;
    expect(out).not.toContain("SUPERSECRET");
    expect(out).not.toContain("sk_live_");
  });
});

describe("stripe-lifecycle.mjs matches the TypeScript module", () => {
  for (const [name, env] of Object.entries(CASES)) {
    it(`agrees on exit code for: ${name}`, () => {
      const expected = planLifecycle(env, { execute: false });
      const actual = withEnvFile(env, (file) => run(LIFECYCLE, ["--config", file]));
      expect(actual.status, actual.out).toBe(expected.exitCode);
    });

    it(`agrees on refusal codes for: ${name}`, () => {
      const expected = planLifecycle(env, { execute: false });
      const out = withEnvFile(env, (file) => run(LIFECYCLE, ["--config", file])).out;
      for (const refusal of expected.refusals) expect(out).toContain(`[${refusal.code}]`);
    });
  }

  it("defaults to a dry run and lists all twenty stages", () => {
    const { status, out } = withEnvFile(CASES.complete, (f) => run(LIFECYCLE, ["--config", f]));
    expect(status).toBe(0);
    expect(out).toContain("DRY-RUN");
    expect(out).toContain("nothing was created, modified, or deleted");
    for (const stage of LIFECYCLE_STAGES) expect(out).toContain(stage.title);
  });

  it("reads the same canonical stage list as the TypeScript module", () => {
    const out = withEnvFile(CASES.complete, (f) => run(LIFECYCLE, ["--config", f])).out;
    expect(out).toContain(`Stages (${LIFECYCLE_STAGES.length})`);
  });

  it("refuses .env.production with exit 88", () => {
    expect(run(LIFECYCLE, ["--config", ".env.production"]).status).toBe(88);
  });

  it("--execute-test-mode still exits non-zero: the lifecycle has never been run", () => {
    const { status, out } = withEnvFile(CASES.complete, (f) => run(LIFECYCLE, ["--config", f, "--execute-test-mode"]));
    expect(status).not.toBe(0);
    expect(out).toContain("not implemented");
  });

  it("--execute-test-mode cannot bypass the live-key refusal", () => {
    const { status } = withEnvFile({ ...CASES.complete, STRIPE_SECRET_KEY: "sk_live_FAKE" }, (f) =>
      run(LIFECYCLE, ["--config", f, "--execute-test-mode"]),
    );
    expect(status).toBe(87);
  });
});
