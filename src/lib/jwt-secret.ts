// Single source of truth for the session/token signing secret.
//
// Previously each auth file hardcoded the same fallback string
// ("matflow-dev-secret-change-in-production"). If JWT_SECRET were ever unset in
// production, that published string would let anyone forge an admin cookie for
// any gym — a full multi-tenant takeover. Production has JWT_SECRET set, so we
// now FAIL CLOSED: throw if it is missing in production, and only fall back to a
// dev-only value locally (with a loud warning).

function resolveSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length > 0) return secret;

  // During `next build` page-data collection, route modules are evaluated even
  // though no token is ever signed/verified, and env vars may not be present.
  // Don't fail the build for that — only fail closed at real runtime.
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  if (process.env.NODE_ENV === "production" && !isBuildPhase) {
    throw new Error(
      "JWT_SECRET is not set. Refusing to start with an insecure fallback in production."
    );
  }

  console.warn(
    "[jwt-secret] JWT_SECRET is not set — using an insecure DEV-ONLY fallback. Set JWT_SECRET in your env."
  );
  return "matflow-dev-secret-change-in-production";
}

export const JWT_SECRET = new TextEncoder().encode(resolveSecret());
