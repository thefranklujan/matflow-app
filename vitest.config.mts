import { defineConfig } from "vitest/config";
import path from "path";

// Node 25 enables the experimental Web Storage global by default; without a
// --localstorage-file it is a stub with no methods that SHADOWS jsdom's
// localStorage, so jsdom suites failed with "localStorage.clear is not a
// function". Disable it for test workers only (the flag exists from Node 22;
// Node 20 would reject it). Production runtime is unaffected.
const nodeMajor = Number(process.versions.node.split(".")[0]);
const workerExecArgv = nodeMajor >= 22 ? ["--no-experimental-webstorage"] : [];

export default defineConfig({
  esbuild: {
    jsx: "automatic", // match Next.js's React 19 automatic JSX runtime
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    poolOptions: {
      forks: { execArgv: workerExecArgv },
      threads: { execArgv: workerExecArgv },
    },
    coverage: {
      provider: "v8",
      // Honest scope: ALL application source (nothing excluded to inflate
      // numbers) except type-only files and the unreachable legacy /admin
      // duplicate tree behind the middleware 307.
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/app/admin/**"],
      reporter: ["text-summary", "json-summary"],
      // Non-regression floor AT/BELOW the proven baseline (2026-07-19:
      // 3% lines / 45.01% branches repo-wide) — a floor, never a target.
      thresholds: { lines: 3, branches: 45 },
    },
  },
});
