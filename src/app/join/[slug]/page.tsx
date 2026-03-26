import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MATFLOW } from "@/lib/constants";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function JoinGymPage({ params }: Props) {
  const { slug } = await params;

  const gym = await prisma.gym.findUnique({
    where: { slug },
    select: { name: true, slug: true, logo: true },
  });

  if (!gym) {
    notFound();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-black px-4">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-white mb-2">Join {gym.name}</h1>
        <p className="text-gray-400 mb-8">
          Create an account to access your member portal, track your progress, and stay connected with your gym.
        </p>

        <div className="space-y-4">
          <Link
            href="/sign-up"
            className="block w-full bg-brand-teal text-brand-black font-bold py-3 rounded-lg hover:bg-brand-teal/90 transition text-center uppercase tracking-wider"
          >
            Sign Up
          </Link>
          <Link
            href="/sign-in"
            className="block w-full border border-brand-gray text-gray-300 font-medium py-3 rounded-lg hover:border-brand-teal hover:text-brand-teal transition text-center"
          >
            Already have an account? Sign In
          </Link>
        </div>

        <p className="text-gray-600 text-sm mt-8">
          Powered by {MATFLOW.name}
        </p>
      </div>
    </div>
  );
}
