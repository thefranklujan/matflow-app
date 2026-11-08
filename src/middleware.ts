import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

// /kiosk and /api/kiosk are deliberately NOT public: the kiosk is off until
// check-in codes are issued (both answer 404). /api/cron is public because
// Vercel Cron sends no cookie; every cron route checks CRON_SECRET itself and
// refuses when it is unset.
const publicPaths = ["/", "/sign-in", "/sign-up", "/join", "/dropin", "/student/sign-up", "/onboarding", "/api/onboarding", "/privacy", "/support", "/forgot-password", "/reset-password", "/app-store", "/app-store-ipad", "/native-web-only", "/api/auth", "/api/webhooks", "/api/leads", "/api/dropin", "/api/track", "/api/unsubscribe", "/unsubscribe", "/api/cron"];

// Commerce is not sold and takes no money (owner-features finding 7): every
// owner and storefront commerce page sends the visitor to /app.
const WEB_COMMERCE_PREFIXES = ["/app/products", "/app/orders", "/app/inventory", "/products", "/cart", "/checkout", "/categories"];

// The iOS/Android app is a free STUDENT-only companion. These owner/admin and
// commerce surfaces must never render inside the native shell (App Store 3.1.1 /
// 2.1(b)). Owner areas send the visitor to the student-only explainer; the
// storefront/checkout (any payment flow) bounces to the student home.
const NATIVE_OWNER_PREFIXES = ["/app", "/admin", "/platform"];
const NATIVE_COMMERCE_PREFIXES = ["/cart", "/checkout", "/products", "/categories"];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Server-authoritative native detection. Capacitor appends "MatFlowNative" to
 * the WebView User-Agent, so we can detect the iOS/Android shell on the FIRST
 * byte of every request — no first-paint cookie race. The client cookie is kept
 * only as defense-in-depth.
 */
function isNativeRequest(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") || "";
  if (ua.includes("MatFlowNative")) return true;
  if (request.cookies.get("matflow-native")?.value === "1") return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const native = isNativeRequest(request);

  // Native shell is student-only. Block owner/admin/commerce BEFORE auth or any
  // HTML renders, regardless of whether the visitor is signed in.
  if (native) {
    if (matchesPrefix(pathname, NATIVE_OWNER_PREFIXES)) {
      return NextResponse.redirect(new URL("/native-web-only", request.url));
    }
    if (matchesPrefix(pathname, NATIVE_COMMERCE_PREFIXES)) {
      return NextResponse.redirect(new URL("/student", request.url));
    }
  }

  // The legacy /admin dashboard has been unified into the modern /app dashboard.
  // Every /admin/* route has a verified /app/* equivalent, so redirect web
  // owners there. (Native /admin was already sent to /native-web-only above, so
  // this only runs for web; /app never redirects back, so there is no loop.)
  if (matchesPrefix(pathname, ["/admin"])) {
    const url = request.nextUrl.clone();
    url.pathname = "/app" + pathname.slice("/admin".length);
    return NextResponse.redirect(url);
  }

  // Rate limit unauthenticated writes (auth, leads, drop-in) before anything else.
  const limited = checkRateLimit(request.method, pathname, clientKey(request.headers));
  if (limited && !limited.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(limited.retryAfter),
          "X-RateLimit-Limit": String(limited.limit),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  // The legacy /members portal read across every academy (audit H1). It is
  // deleted; old links and bookmarks land in the student app.
  if (matchesPrefix(pathname, ["/members"])) {
    return NextResponse.redirect(new URL("/student", request.url));
  }

  if (matchesPrefix(pathname, WEB_COMMERCE_PREFIXES)) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  const res = routeAuth(request, pathname);
  if (limited) {
    res.headers.set("X-RateLimit-Limit", String(limited.limit));
    res.headers.set("X-RateLimit-Remaining", String(limited.remaining));
  }
  return res;
}

function routeAuth(request: NextRequest, pathname: string): NextResponse {
  // Allow public paths
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Check for session cookie
  const session = request.cookies.get("matflow-session");
  if (!session) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
