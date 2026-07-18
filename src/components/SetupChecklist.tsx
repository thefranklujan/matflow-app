import Link from "next/link";
import { CheckCircle2, Circle, ArrowUpRight, type LucideIcon } from "lucide-react";

export interface SetupStep {
  key: string;
  label: string;
  description: string;
  href: string;
  /** The icon shown for actionable (non-derivable) steps. */
  icon: LucideIcon;
  /**
   * true  = we can safely derive this is done,
   * false = we can safely derive this is not done,
   * null  = completion cannot be reliably derived, so it is shown as an
   *         always-available action rather than a (fabricated) incomplete state.
   */
  done: boolean | null;
}

/**
 * First-run setup guide for academy owners. Presentational only — the dashboard
 * derives each step's real completion state server-side and passes it in. Steps
 * whose completion cannot be derived are rendered as neutral actions, never as
 * false "incomplete" items.
 */
export function SetupChecklist({ steps, gymName }: { steps: SetupStep[]; gymName: string }) {
  const derivable = steps.filter((s) => s.done !== null);
  const completed = derivable.filter((s) => s.done === true).length;
  const total = derivable.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <section className="mb-6 rounded-lg border border-white/10 bg-[#1a1a1a] p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">
            Finish setting up {gymName}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            A few steps to get your academy ready for members.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-[#c4b5a0]">
            {completed} of {total}
          </p>
          <p className="text-xs text-gray-500">complete</p>
        </div>
      </div>

      <div
        className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-white/5"
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Setup progress"
      >
        <div className="h-full rounded-full bg-[#c4b5a0] transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="space-y-1">
        {steps.map((step) => {
          const Icon = step.icon;
          const isDone = step.done === true;
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-white/5"
              >
                <span className="shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : step.done === false ? (
                    <Circle className="h-5 w-5 text-gray-600" />
                  ) : (
                    <Icon className="h-5 w-5 text-[#c4b5a0]" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-medium ${
                      isDone ? "text-gray-500 line-through" : "text-white"
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="block text-xs text-gray-500">{step.description}</span>
                </span>
                {!isDone && (
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-600 transition group-hover:text-[#c4b5a0]" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
