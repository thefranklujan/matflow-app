import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/", "/sign-in", "/sign-up", "/join", "/dropin", "/kiosk", "/student/sign-up", "/privacy", "/support", "/forgot-password", "/reset-password", "/app-store", "/app-store-ipad", "/native-web-only", "/api/auth", "/api/webhooks", "/api/leads", "/api/kiosk", "/api/dropin", "/api/track", "/api/unsubscribe", "/unsubscribe"];

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
