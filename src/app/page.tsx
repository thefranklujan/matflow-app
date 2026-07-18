import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, GraduationCap } from "lucide-react";
import { MATFLOW } from "@/lib/constants";
import { getSession } from "@/lib/local-auth";
import { isNativeRequest } from "@/lib/native";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Server-authoritative native detection (User-Agent first, cookie fallback)
  // so the gym-owner trial pitch never flashes inside the native shell.
  const isNative = await isNativeRequest();

  // If the visitor already has a valid session, skip the landing page and
  // bounce them straight to their dashboard. This happens server-side so
  // there's zero visual flash, particularly important for the native iOS
  // shell which always loads `/` on launch.
  const session = await getSession();
  if (session) {
    if (session.userType === "student") redirect("/student");
    // Native iOS gym owners go to the web only landing per App Store
    // 3.1.1. Web owners get the full dashboard.
    redirect(isNative ? "/native-web-only" : "/app");
  }

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

  // Web visitors get the marketing landing with two truthful, distinct paths:
  // academy owners (the web SaaS + trial) and students (the free companion).
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-black px-4 py-16">
      <div className="w-full max-w-3xl text-center">
        <h1 className="text-4xl sm:text-6xl font-bold text-white mb-4 tracking-tight">
          {MATFLOW.name}
        </h1>
        <p className="text-lg sm:text-xl text-gray-400 mb-3">{MATFLOW.tagline}</p>
        <p className="text-gray-500 mb-10 max-w-lg mx-auto leading-relaxed">
          The platform for Jiu Jitsu academies. Manage members, schedule classes,
          track attendance, and grow your gym.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
          {/* Academy owners: web SaaS with a free trial */}
          <div className="flex flex-col rounded-lg border border-brand-gray bg-brand-dark p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-accent/10">
              <Building2 className="h-5 w-5 text-brand-accent" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">Academy owners</h2>
            <p className="mb-5 flex-1 text-sm text-gray-500 leading-relaxed">
              Run your gym from one place. Members, schedule, attendance, belt
              tracking, and announcements.
            </p>
            <Link
              href="/sign-up"
              className="w-full rounded-lg bg-brand-accent px-6 py-3 text-center text-sm font-bold uppercase tracking-wider text-brand-black transition hover:bg-brand-accent/90"
            >
              Start free trial
            </Link>
            <Link
              href="/sign-in"
              className="mt-2 w-full rounded-lg px-6 py-2.5 text-center text-sm font-medium text-gray-400 transition hover:text-white"
            >
              Owner sign in
            </Link>
          </div>

          {/* Students: the free training companion */}
          <div className="flex flex-col rounded-lg border border-brand-gray bg-brand-dark p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-accent/10">
              <GraduationCap className="h-5 w-5 text-brand-accent" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">Students</h2>
            <p className="mb-5 flex-1 text-sm text-gray-500 leading-relaxed">
              Find your academy, track every session, log your training, and
              follow your belt journey.
            </p>
            <Link
              href="/student/sign-up"
              className="w-full rounded-lg border-2 border-brand-accent px-6 py-3 text-center text-sm font-bold uppercase tracking-wider text-brand-accent transition hover:bg-brand-accent hover:text-brand-black"
            >
              Create student account
            </Link>
            <Link
              href="/sign-in"
              className="mt-2 w-full rounded-lg px-6 py-2.5 text-center text-sm font-medium text-gray-400 transition hover:text-white"
            >
              Student sign in
            </Link>
          </div>
        </div>

        <p className="text-gray-600 text-xs mt-10">
          Powered by {MATFLOW.name}
        </p>
      </div>
    </div>
  );
}
