import Link from "next/link";
import { Mail, Shield, Trash2, HelpCircle } from "lucide-react";

export const metadata = {
  title: "Support | MatFlow",
  description: "Get help with MatFlow — Jiu Jitsu training companion and gym management platform.",
};

export default function SupportPage() {
  return (
    <div className="min-h-[100dvh] bg-[#080808] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="MatFlow" className="h-12 w-auto mb-10" />

        <h1 className="text-4xl font-bold mb-3">Support</h1>
        <p className="text-gray-400 text-lg mb-12">
          We&apos;re here to help. Reach us any way that&apos;s easiest for you.
        </p>

        <section className="space-y-6 mb-16">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6 flex items-start gap-4">
            <div className="h-11 w-11 rounded-lg bg-[#dc2626]/10 text-[#dc2626] flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-lg mb-1">Email us</h2>
              <p className="text-gray-400 text-sm mb-2">
                Questions about training log, belt tracking, gym management, billing, or anything else.
              </p>
              <a href="mailto:frank@mymatflow.com" className="text-[#dc2626] hover:underline">
                frank@mymatflow.com
              </a>
              <p className="text-gray-600 text-xs mt-2">Typical response: within one business day.</p>
            </div>
          </div>

          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6 flex items-start gap-4">
            <div className="h-11 w-11 rounded-lg bg-[#dc2626]/10 text-[#dc2626] flex items-center justify-center shrink-0">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-lg mb-1">Delete your account</h2>
              <p className="text-gray-400 text-sm mb-2">
                Sign in, open Settings, and scroll to the Danger zone section. Your account and
                training data will be permanently removed.
              </p>
              <Link href="/sign-in" className="text-[#dc2626] hover:underline text-sm">
                Sign in to delete account
              </Link>
            </div>
          </div>

          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6 flex items-start gap-4">
            <div className="h-11 w-11 rounded-lg bg-[#dc2626]/10 text-[#dc2626] flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-lg mb-1">Privacy & data</h2>
              <p className="text-gray-400 text-sm mb-2">
                How we collect, store, and use your training and gym data.
              </p>
              <Link href="/privacy" className="text-[#dc2626] hover:underline text-sm">
                Read the privacy policy
              </Link>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-[#dc2626]" /> Common questions
          </h2>
          <div className="space-y-4">
            <details className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5">
              <summary className="font-semibold text-white cursor-pointer">
                I forgot my password. How do I reset it?
              </summary>
              <p className="text-gray-400 text-sm mt-3">
                On the sign-in screen, tap &ldquo;Forgot password?&rdquo; and enter the email on
                your account. We&apos;ll send a reset link that&apos;s good for one hour.
              </p>
            </details>
            <details className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5">
              <summary className="font-semibold text-white cursor-pointer">
                My gym isn&apos;t on MatFlow yet. What do I do?
              </summary>
              <p className="text-gray-400 text-sm mt-3">
                Create a student account, then tap Nominate Gym. Once enough students from the
                same academy nominate it, we reach out to the gym directly to get them set up.
                Active is free for the owner.
              </p>
            </details>
            <details className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5">
              <summary className="font-semibold text-white cursor-pointer">
                I&apos;m a gym owner. How do I get my academy on MatFlow?
              </summary>
              <p className="text-gray-400 text-sm mt-3">
                Sign up at the &ldquo;Start Free Trial&rdquo; link and select &ldquo;I own a gym.&rdquo;
                You get 30 days free to manage schedules, students, attendance, and more.
                Email us if you&apos;d like a walkthrough.
              </p>
            </details>
            <details className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5">
              <summary className="font-semibold text-white cursor-pointer">
                How does the geofence gym-arrival work?
              </summary>
              <p className="text-gray-400 text-sm mt-3">
                If your gym owner has enabled the location feature, MatFlow uses your phone&apos;s
                location to detect when you arrive at the gym and logs an arrival. You can
                disable this in iOS Settings → MatFlow → Location any time.
              </p>
            </details>
            <details className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5">
              <summary className="font-semibold text-white cursor-pointer">
                What data does MatFlow collect?
              </summary>
              <p className="text-gray-400 text-sm mt-3">
                Training sessions you log, belt progression, attendance, gym membership, and
                optionally your location for arrival check-ins. We never sell your data. See the{" "}
                <Link href="/privacy" className="text-[#dc2626] hover:underline">
                  privacy policy
                </Link>{" "}
                for the full breakdown.
              </p>
            </details>
          </div>
        </section>

        <div className="mt-16 pt-8 border-t border-white/10 text-center">
          <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm">
            ← Back to MatFlow
          </Link>
        </div>
      </div>
    </div>
  );
}
