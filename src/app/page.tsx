import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { MATFLOW } from "@/lib/constants";
import { getSession } from "@/lib/local-auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // If the visitor already has a valid session, skip the landing page and
  // bounce them straight to their dashboard. This happens server-side so
  // there's zero visual flash, particularly important for the native iOS
  // shell which always loads `/` on launch.
  const session = await getSession();
  if (session) {
    if (session.userType === "student") redirect("/student");
    // Native iOS gym owners go to the web only landing per App Store
    // 3.1.1. Web owners get the full dashboard.
    const c = await cookies();
    const isNative = c.get("matflow-native")?.value === "1";
    redirect(isNative ? "/native-web-only" : "/app");
  }

  // Detect native iOS shell so we hide the gym owner trial pitch and
  // render only the student facing call to action. The marker cookie is
  // set on first paint by NativeCookieMarker.
  const c = await cookies();
  const isNative = c.get("matflow-native")?.value === "1";

  if (isNative) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-black px-4">
        <div className="text-center max-w-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt={MATFLOW.name} className="mx-auto mb-6 h-16 w-auto" />
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
            The Jiu Jitsu training app
          </h1>
          <p className="text-gray-400 mb-10 max-w-sm mx-auto leading-relaxed">
            Track every session. Find your gym. Roll with your team.
          </p>

          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <Link
              href="/student/sign-up"
              className="bg-brand-accent text-brand-black font-bold px-8 py-4 rounded-lg hover:bg-brand-accent/90 transition text-base uppercase tracking-wider"
            >
              Create student account
            </Link>
            <Link
              href="/sign-in"
              className="border-2 border-brand-accent text-brand-accent font-bold px-8 py-4 rounded-lg hover:bg-brand-accent hover:text-brand-black transition text-base uppercase tracking-wider"
            >
              Sign In
            </Link>
          </div>

          <p className="text-gray-600 text-xs mt-8">
            Powered by {MATFLOW.name}
          </p>
        </div>
      </div>
    );
  }

  // Web visitors get the full marketing landing.
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-black px-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl sm:text-6xl font-bold text-white mb-4 tracking-tight">
          {MATFLOW.name}
        </h1>
        <p className="text-xl text-gray-400 mb-2">{MATFLOW.tagline}</p>
        <p className="text-gray-500 mb-10 max-w-lg mx-auto">
          The all in one platform for Jiu Jitsu academies. Manage members, track attendance,
          run your pro shop, and grow your gym.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/sign-up"
            className="bg-brand-accent text-brand-black font-bold px-8 py-4 rounded-lg hover:bg-brand-accent/90 transition text-lg uppercase tracking-wider"
          >
            Start Free Trial
          </Link>
          <Link
            href="/sign-in"
            className="border-2 border-brand-accent text-brand-accent font-bold px-8 py-4 rounded-lg hover:bg-brand-accent hover:text-brand-black transition text-lg uppercase tracking-wider"
          >
            Sign In
          </Link>
        </div>

        <p className="text-gray-600 text-sm mt-8">
          Powered by {MATFLOW.name}
        </p>
      </div>
    </div>
  );
}
