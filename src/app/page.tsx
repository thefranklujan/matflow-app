import Link from "next/link";
import { redirect } from "next/navigation";
import { MATFLOW } from "@/lib/constants";
import { getSession } from "@/lib/local-auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // If the visitor already has a valid session, skip the landing page and
  // bounce them straight to their dashboard. This happens server-side so
  // there's zero visual flash — particularly important for the native iOS
  // shell which always loads `/` on launch.
  const session = await getSession();
  if (session) {
    redirect(session.userType === "student" ? "/student" : "/app");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-black px-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl sm:text-6xl font-bold text-white mb-4 tracking-tight">
          {MATFLOW.name}
        </h1>
        <p className="text-xl text-gray-400 mb-2">{MATFLOW.tagline}</p>
        <p className="text-gray-500 mb-10 max-w-lg mx-auto">
          The all-in-one platform for Jiu Jitsu academies. Manage members, track attendance,
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
