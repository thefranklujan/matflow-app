/**
 * OneSignal push notification helper.
 * Env-var driven: no-ops gracefully when credentials aren't set so the app
 * keeps working in dev or before OneSignal is provisioned in Vercel.
 *
 * Targeting strategy: we use `include_aliases: { external_id: [...] }` keyed
 * on the session userId (which OneSignal.login(userId) tags on the client).
 * Works for both gym owners ("member-...", "owner-...") and students
 * ("student-..."). Safer than segments because it targets specific users.
 */

const APP_ID = process.env.ONESIGNAL_APP_ID || "";
const REST_KEY = process.env.ONESIGNAL_REST_API_KEY || "";
const ENDPOINT = "https://api.onesignal.com/notifications";

export interface PushOptions {
  externalIds: string[];
  title: string;
  body: string;
  url?: string;
  iconUrl?: string;
  data?: Record<string, unknown>;
}

function isConfigured() {
  return Boolean(APP_ID && REST_KEY);
}

/**
 * Fire-and-forget. Never throws into the caller — a broken push must never
 * block the primary action (approving a member, creating an announcement).
 * Always logs failures server-side so they're visible in Vercel logs.
 */
export async function sendPush(opts: PushOptions): Promise<void> {
  if (!isConfigured()) {
    console.log("[push] skipped — ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY not set");
    return;
  }

  const externalIds = opts.externalIds.filter(Boolean);
  if (externalIds.length === 0) {
    console.log("[push] skipped — no external_ids to target");
    return;
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${REST_KEY}`,
      },
      body: JSON.stringify({
        app_id: APP_ID,
        include_aliases: { external_id: externalIds },
        target_channel: "push",
        headings: { en: opts.title },
        contents: { en: opts.body },
        url: opts.url,
        chrome_web_icon: opts.iconUrl,
        data: opts.data,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[push] OneSignal ${res.status}: ${text}`);
    }
  } catch (err) {
    console.error("[push] fetch failed:", err);
  }
}

/**
 * Fan-out helper: push to every external_id in the list, split into 2000-id
 * batches (OneSignal's per-request limit).
 */
export async function sendBulkPush(opts: PushOptions): Promise<void> {
  const BATCH = 2000;
  for (let i = 0; i < opts.externalIds.length; i += BATCH) {
    await sendPush({ ...opts, externalIds: opts.externalIds.slice(i, i + BATCH) });
  }
}

/**
 * Build the external_id used for OneSignal.login() on the client.
 * Must match session.userId exactly so the fan-out can target the right user.
 */
export function externalIdForSession(session: { userId: string }) {
  return session.userId;
}
