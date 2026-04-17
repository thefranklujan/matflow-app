import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | MatFlow",
  description: "How MatFlow collects, uses, and protects your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="text-gray-500 hover:text-white text-sm mb-8 inline-block">
          &larr; Back
        </Link>
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-8">Last updated: April 17, 2026</p>

        <div className="space-y-6 text-gray-300 leading-relaxed">
          <p>
            MatFlow (&ldquo;we&rdquo;, &ldquo;us&rdquo;) provides gym management software for
            Jiu Jitsu academies and their students. This policy describes what we collect,
            why, and how you can control it.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">What we collect</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Account: name, email, phone number, password (hashed).</li>
              <li>Training profile: belt rank, stripes, home gym, training history you log.</li>
              <li>Gym membership: which gym(s) you belong to, attendance, waiver signatures.</li>
              <li>Device: push notification token, app version, OS version.</li>
              <li>Location (optional): only when you use features that require it (e.g., log
                training when near your gym) and only with your explicit permission.</li>
              <li>Photos (optional): profile pictures you upload.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">How we use it</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide core functionality: show your schedule, log attendance, deliver
                announcements from your gym.</li>
              <li>Send notifications you asked for (class reminders, belt promotions,
                announcements).</li>
              <li>Let gym owners manage their rosters and communicate with members.</li>
            </ul>
            <p className="mt-2">
              We do <strong>not</strong> sell your data. We do <strong>not</strong> use your
              data for third-party advertising.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Sharing</h2>
            <p>
              We share your profile with the gym(s) you&apos;ve joined — they can see your
              attendance, belt, and contact info to run their academy. We use service
              providers (Supabase for database, Vercel for hosting, OneSignal for push
              notifications, SendGrid/Resend for email) strictly to operate MatFlow; they
              cannot use your data for other purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Your controls</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Edit your profile or delete your account any time from Profile settings.</li>
              <li>Turn off notifications in Profile → Notifications or iOS Settings.</li>
              <li>Revoke location / camera access in iOS Settings → MatFlow.</li>
              <li>
                Email{" "}
                <a href="mailto:frank@craftedsystems.io" className="text-[#c4b5a0] hover:underline">
                  frank@craftedsystems.io
                </a>{" "}
                to request your data or deletion.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Children</h2>
            <p>
              MatFlow is not directed at children under 13. If a student is under 18, a
              parent or guardian should supervise account creation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Contact</h2>
            <p>
              Crafted Systems LLC<br />
              Email:{" "}
              <a href="mailto:frank@craftedsystems.io" className="text-[#c4b5a0] hover:underline">
                frank@craftedsystems.io
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
