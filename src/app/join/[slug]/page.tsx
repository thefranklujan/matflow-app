import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MATFLOW } from "@/lib/constants";
import { getSession } from "@/lib/local-auth";
import JoinWhenSignedIn from "./JoinWhenSignedIn";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export default async function JoinGymPage({ params }: Props) {
  const { slug } = await params;

  const gym = await prisma.gym.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, logo: true },
  });

  if (!gym) {
    notFound();
  }

  const session = await getSession();

  // Already signed in: figure out where they stand with this gym so we can show
  // the right action instead of forcing a fresh sign-up.
  let signedInState: "member-here" | "member-elsewhere" | "owner" | "can-join" | null = null;
  if (session) {
    if (session.userType === "member" && session.role === "admin") {
      signedInState = "owner";
    } else if (session.studentId) {
      const here = await prisma.member.findFirst({
        where: { studentId: session.studentId, gymId: gym.id, active: true, approved: true },
        select: { id: true },
      });
      if (here) {
        signedInState = "member-here";
      } else {
        const elsewhere = await prisma.member.findFirst({
          where: { studentId: session.studentId, gymId: { not: gym.id } },
          select: { id: true },
        });
        signedInState = elsewhere ? "member-elsewhere" : "can-join";
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-black px-4">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-white mb-2">Join {gym.name}</h1>
        <p className="text-gray-400 mb-8">
          Create an account to access your member portal, track your progress, and stay connected with your gym.
        </p>

        {signedInState === "member-here" ? (
          <div className="space-y-4">
            <p className="text-brand-accent text-sm">You&apos;re already a member of {gym.name}.</p>
            <Link
              href="/student"
              className="block w-full bg-brand-accent text-brand-black font-bold py-3 rounded-lg hover:bg-brand-accent/90 transition text-center uppercase tracking-wider"
            >
              Go to my portal
            </Link>
          </div>
        ) : signedInState === "member-elsewhere" ? (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">
              You&apos;re already a member of another gym. Each account belongs to one gym — contact your gym to transfer.
            </p>
            <Link
              href="/student"
              className="block w-full border border-brand-gray text-gray-300 font-medium py-3 rounded-lg hover:border-brand-accent hover:text-brand-accent transition text-center"
            >
              Go to my portal
            </Link>
          </div>
        ) : signedInState === "can-join" ? (
          <JoinWhenSignedIn gymSlug={gym.slug} gymName={gym.name} />
        ) : signedInState === "owner" ? (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">
              You&apos;re signed in as a gym owner. Sign out first to join {gym.name} as a member.
            </p>
            <Link
              href="/app"
              className="block w-full border border-brand-gray text-gray-300 font-medium py-3 rounded-lg hover:border-brand-accent hover:text-brand-accent transition text-center"
            >
              Back to my dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <Link
              href={`/sign-up?join=${gym.slug}`}
              className="block w-full bg-brand-accent text-brand-black font-bold py-3 rounded-lg hover:bg-brand-accent/90 transition text-center uppercase tracking-wider"
            >
              Sign Up
            </Link>
            <Link
              href="/sign-in"
              className="block w-full border border-brand-gray text-gray-300 font-medium py-3 rounded-lg hover:border-brand-accent hover:text-brand-accent transition text-center"
            >
              Already have an account? Sign In
            </Link>
          </div>
        )}

        <p className="text-gray-600 text-sm mt-8">
          Powered by {MATFLOW.name}
        </p>
      </div>
    </div>
  );
}
