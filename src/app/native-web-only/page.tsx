import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/local-auth";

export const dynamic = "force-dynamic";

/**
 * Destination page for gym owners who sign in from the iOS app. The iOS
 * build is a Students and Community only experience. Gym management
 * (members, schedule, attendance, announcements, billing, analytics) lives
 * exclusively on the web dashboard at app.mymatflow.com. This page exists
 * so the user is not dropped into owner dashboard views on mobile.
 */
export default async function NativeWebOnlyPage() {
  const session = await getSession();
  // Students should never land here; bounce them to the student experience.
  if (session?.userType === "student") {
    redirect("/student");
  }

  const name = session?.name || "there";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#080808] px-6 text-center">
      <div className="w-full max-w-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="MatFlow" className="mx-auto mb-8 h-14 w-auto" />

        <h1 className="text-3xl font-bold text-white mb-3">
          Gym management is on the web
        </h1>

        <p className="text-gray-400 mb-8 leading-relaxed">
          Hi {name}. Your gym owner dashboard (members, schedule, attendance,
          announcements, billing, analytics) lives at
          {" "}
          <span className="text-white font-medium">app.mymatflow.com</span>.
          Open it in Safari or Chrome on any device to manage your gym.
        </p>

        <div className="rounded-xl border border-white/10 bg-[#111] p-5 mb-6 text-left">
          <p className="text-sm text-gray-300 font-medium mb-2">
            What the iOS app is for
          </p>
          <ul className="text-sm text-gray-500 space-y-1 list-none pl-0">
            <li>Students: log training, view schedule, find gyms.</li>
            <li>Instructors and members: track progression, roll with your team.</li>
            <li>Community: discover academies and connect with training partners.</li>
          </ul>
        </div>

        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-semibold py-3 rounded-lg transition"
          >
            Sign out
          </button>
        </form>

        <p className="text-gray-600 text-xs mt-5">
          Sign in again with a student or instructor account to use the app,
          or open{" "}
          <Link href="https://app.mymatflow.com" className="text-[#dc2626] hover:underline">
            app.mymatflow.com
          </Link>
          {" "}on the web to manage your gym.
        </p>
      </div>
    </div>
  );
}
