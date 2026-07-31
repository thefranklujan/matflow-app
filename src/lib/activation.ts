/**
 * THE activation definition for MatFlow academies.
 *
 * One module, shared by the owner dashboard and the founder sales queue, so
 * "activated" can never mean two different things in two places.
 *
 * Pure: no DB, no React, no clock access — callers pass the facts and `now`.
 *
 * Deliberate boundaries:
 * - The owner is a Member of their own academy, so a "first real member"
 *   requires the active member count to exceed the owner-only baseline.
 * - Activation is SETUP only. Attendance is tracked separately as live usage,
 *   because a fully configured academy that never checks anyone in is a very
 *   different sales conversation from one that is running classes.
 * - Activation is never inferred from trial status, subscription state, or how
 *   old the academy is.
 */

/** A Member row exists for the owner, so one active member means "owner only". */
export const OWNER_BASELINE_MEMBERS = 1;

export type MilestoneKey = "profile" | "firstMember" | "instructor" | "schedule";

export interface ActivationFacts {
  /** Academy profile completeness inputs. */
  description: string | null;
  city: string | null;
  state: string | null;
  /** Members that are active AND approved (owner included). */
  activeMemberCount: number;
  /** Instructors flagged active. */
  activeInstructorCount: number;
  /** Class schedule rows flagged active. */
  activeScheduleCount: number;
  /** Any attendance record ever recorded for this academy. */
  attendanceCount: number;
}

export interface Milestone {
  key: MilestoneKey;
  label: string;
  description: string;
  complete: boolean;
  /** Where the owner goes to finish it. */
  href: string;
}

export type ActivationState = "not_started" | "in_progress" | "activated";
export type LiveUsageState = "no_attendance" | "live";

export interface ActivationResult {
  milestones: Milestone[];
  completedCount: number;
  totalCount: number;
  percentComplete: number;
  nextMilestone: Milestone | null;
  activationState: ActivationState;
  isActivated: boolean;
  liveUsageState: LiveUsageState;
  hasLiveUsage: boolean;
}

function isFilled(value: string | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Setup started = the academy exists, which is true for every caller of this
 * function. `not_started` therefore means "exists but nothing configured yet".
 */
export function evaluateActivation(facts: ActivationFacts): ActivationResult {
  const milestones: Milestone[] = [
    {
      key: "profile",
      label: "Complete your academy profile",
      description: "Add a description, city, and state so students can find you.",
      complete: isFilled(facts.description) && isFilled(facts.city) && isFilled(facts.state),
      href: "/app/settings",
    },
    {
      key: "firstMember",
      label: "Add your first member",
      description: "Share your join link or add a member by hand.",
      complete: facts.activeMemberCount > OWNER_BASELINE_MEMBERS,
      href: "/app/members",
    },
    {
      key: "instructor",
      label: "Add an instructor",
      description: "List who teaches so you can assign classes.",
      complete: facts.activeInstructorCount > 0,
      href: "/app/instructors",
    },
    {
      key: "schedule",
      label: "Create your first class",
      description: "Build your weekly schedule so members can check in.",
      complete: facts.activeScheduleCount > 0,
      href: "/app/schedule",
    },
  ];

  const completedCount = milestones.filter((m) => m.complete).length;
  const totalCount = milestones.length;
  const isActivated = completedCount === totalCount;
  const nextMilestone = milestones.find((m) => !m.complete) ?? null;

  const activationState: ActivationState = isActivated
    ? "activated"
    : completedCount === 0
      ? "not_started"
      : "in_progress";

  const hasLiveUsage = facts.attendanceCount > 0;

  return {
    milestones,
    completedCount,
    totalCount,
    percentComplete: Math.round((completedCount / totalCount) * 100),
    nextMilestone,
    activationState,
    isActivated,
    liveUsageState: hasLiveUsage ? "live" : "no_attendance",
    hasLiveUsage,
  };
}

/* ------------------------------------------------------------------ *
 * Trial helpers — time is injected so results are deterministic.
 * ------------------------------------------------------------------ */

/**
 * Whole days from `now` until the trial ends. Negative means already expired;
 * null when the academy has no trial end recorded.
 */
export function trialDaysRemaining(trialEndsAt: Date | null, now: Date): number | null {
  if (!trialEndsAt) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((trialEndsAt.getTime() - now.getTime()) / msPerDay);
}

/** Whole days since the academy was created (0 on the day it signed up). */
export function daysSince(date: Date, now: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((now.getTime() - date.getTime()) / msPerDay);
}
