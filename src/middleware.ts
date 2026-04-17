import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/", "/sign-in", "/sign-up", "/join", "/kiosk", "/student/sign-up", "/privacy", "/api/auth", "/api/webhooks", "/api/leads", "/api/kiosk", "/api/track", "/api/unsubscribe", "/unsubscribe"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
