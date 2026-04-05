import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import Link from "next/link";

export const dynamic = "force-dynamic";

const GOAL_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  "monthly-attendance": {
    label: "Attendance",
    color: "bg-blue-500/20 text-blue-400",
  },
  "weekly-streak": {
    label: "Streak",
    color: "bg-purple-500/20 text-purple-400",
  },
  competition: {
    label: "Competition",
    color: "bg-yellow-500/20 text-yellow-400",
  },
  custom: {
    label: "Custom",
    color: "bg-gray-500/20 text-gray-400",
  },
};

export default async function GoalsPage() {
  const { memberId } = await requireMember();

  const goals = memberId
    ? await prisma.personalGoal.findMany({
        where: { memberId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const activeGoals = goals.filter((g) => !g.completed);
  const completedGoals = goals.filter((g) => g.completed);

  return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/members/leaderboard"
            className="text-gray-400 hover:text-white transition text-sm"
          >
            &larr; Back to Leaderboard
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-2xl font-bold text-white uppercase tracking-wider">
            My Goals
          </h1>
          <Link
            href="/members/leaderboard/goals/new"
            className="bg-brand-accent text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-accent/90 transition text-sm text-center"
          >
            + Set New Goal
          </Link>
        </div>

        {/* Active Goals */}
        {activeGoals.length > 0 ? (
          <div className="space-y-4 mb-10">
            {activeGoals.map((goal) => {
              const progress =
                goal.targetValue > 0
                  ? Math.min(
                      (goal.currentValue / goal.targetValue) * 100,
                      100
                    )
                  : 0;
              const typeInfo =
                GOAL_TYPE_LABELS[goal.goalType] || GOAL_TYPE_LABELS.custom;

              return (
                <div
                  key={goal.id}
                  className="bg-brand-dark border border-brand-gray rounded-lg p-6"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-white font-medium text-lg">
                        {goal.title}
                      </h3>
                      {goal.endDate && (
                        <p className="text-gray-500 text-xs mt-1">
                          Due{" "}
                          {new Date(goal.endDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium ${typeInfo.color}`}
                    >
                      {typeInfo.label}
                    </span>
                  </div>

                  <div className="mb-2">
                    <div className="w-full h-3 bg-brand-gray rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-accent rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">
                      {goal.currentValue}/{goal.targetValue}
                    </span>
                    <span className="text-sm text-brand-accent font-bold">
                      {Math.round(progress)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-brand-dark border border-brand-gray rounded-lg p-12 text-center mb-10">
            <p className="text-gray-500 mb-4">No active goals yet.</p>
            <Link
              href="/members/leaderboard/goals/new"
              className="text-brand-accent hover:text-brand-accent/80 transition text-sm font-medium"
            >
              Set your first goal &rarr;
            </Link>
          </div>
        )}

        {/* Completed Goals */}
        {completedGoals.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Completed
            </h2>
            <div className="space-y-3 opacity-60">
              {completedGoals.map((goal) => {
                const typeInfo =
                  GOAL_TYPE_LABELS[goal.goalType] || GOAL_TYPE_LABELS.custom;
                return (
                  <div
                    key={goal.id}
                    className="bg-brand-dark border border-brand-gray rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className="w-5 h-5 text-brand-accent flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-white font-medium">
                        {goal.title}
                      </span>
                    </div>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium ${typeInfo.color}`}
                    >
                      {typeInfo.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
  );
}
