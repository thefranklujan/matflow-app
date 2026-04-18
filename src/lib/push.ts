/**
 * OneSignal push notification helper + in-app inbox persistence.
 * Env-var driven: no-ops gracefully when credentials aren't set so the app
 * keeps working in dev or before OneSignal is provisioned in Vercel.
 *
 * Targeting strategy: we use `include_aliases: { external_id: [...] }` keyed
 * on the session userId (which OneSignal.login(userId) tags on the client).
 * Works for both gym owners ("member-...", "owner-...") and students
 * ("student-..."). Safer than segments because it targets specific users.
 */

import { prisma } from "@/lib/prisma";

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

export type NotificationKind =
  | "announcement"
  | "join_request"
  | "join_approved"
  | "join_rejected"
  | "belt_promotion"
  | "waiver_required"
  | "class_reminder"
  | "post_reply"
  | "attendance_streak"
  | "competition_result"
  | "test";

interface NotifyOptions {
  externalIds: string[];
  kind: NotificationKind;
  title: string;
  body: string;
  url?: string;
  iconUrl?: string;
  gymId?: string;
}

/**
 * One call = persist to the Notification inbox AND fire the push.
 * Use this instead of sendPush/sendBulkPush for any user-facing event.
 * Inbox writes are best-effort; push is still attempted even if DB write fails.
 */
// Base origin for absolute URLs in push payloads. OneSignal's native iOS SDK
// opens http/https URLs inside the Capacitor webview when the origin matches
// the web app, giving real deep-link behavior (tap push → opens inbox page).
const PUSH_URL_BASE = process.env.PUSH_URL_BASE || "https://app.mymatflow.com";

function absolutize(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${PUSH_URL_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function notify(opts: NotifyOptions): Promise<void> {
  // Dedupe aliases — callers often pass both session.userId and the student-id
  // form of the same user, which would double-deliver both the push and the
  // inbox row.
  const externalIds = Array.from(new Set(opts.externalIds.filter(Boolean)));
  if (externalIds.length === 0) return;

  const absoluteUrl = absolutize(opts.url);

  // Persist inbox rows first — we want a log even if push is disabled/unavailable.
  try {
    await prisma.notification.createMany({
      data: externalIds.map((externalId) => ({
        externalId,
        gymId: opts.gymId || null,
        kind: opts.kind,
        title: opts.title,
        body: opts.body,
        // Store the RELATIVE URL in the inbox so in-app links stay within the app
        url: opts.url || null,
        iconUrl: opts.iconUrl || null,
      })),
    });
  } catch (err) {
    console.error("[notify] inbox persist failed:", err);
  }

  // Fire push in parallel/after — failures don't affect the inbox row.
  // For native clients (iOS/Android), use absolute URL so OneSignal can open
  // the deep link correctly.
  await sendBulkPush({
    externalIds,
    title: opts.title,
    body: opts.body,
    url: absoluteUrl,
    iconUrl: opts.iconUrl,
    data: { kind: opts.kind, gymId: opts.gymId, path: opts.url },
  });
}
