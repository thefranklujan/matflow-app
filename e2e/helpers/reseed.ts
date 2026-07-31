import fs from "fs";
import path from "path";
import { seed, disconnect } from "./seed";
import { AUTH_DIR } from "./env";

/**
 * Re-runs the idempotent fixture seed and republishes the fixture id map.
 *
 * Schedules/attendance are recreated with new ids on every seed, so the id map
 * MUST be rewritten in the same step — functional specs read it lazily inside
 * each test, so they always pick up the current ids.
 */
export async function reseedFixtures(): Promise<void> {
  const ids = await seed();
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(path.join(AUTH_DIR, "fixture-ids.json"), JSON.stringify(ids, null, 2));
  await disconnect();
}
