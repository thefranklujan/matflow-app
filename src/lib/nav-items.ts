export type NavGroup = "Run" | "Grow" | "Content" | "Manage";

export interface NavItem {
  slug: string;
  label: string;
  icon: string;
  roles: ("admin" | "member")[];
  group: NavGroup;
  section?: "main" | "bottom";
  /** Pro-plan feature: nav shows a "Pro" badge for non-Pro gyms; the page renders an upgrade screen. */
  pro?: boolean;
}

// Order the owner navigation is grouped in:
//   Run      — daily operations (roster, schedule, check-ins)
//   Grow     — acquisition and engagement (leads, drop-ins, announcements)
//   Content  — member-facing content (videos)
//   Manage   — configuration and back office (analytics, waivers, settings…)
// Commerce (products, orders, inventory) was removed from the owner nav: it is
// not sold and takes no money (owner-features finding 7). Its routes redirect.
export const NAV_GROUP_ORDER: NavGroup[] = ["Run", "Grow", "Content", "Manage"];

export const NAV_ITEMS: NavItem[] = [
  // Run
  { slug: "requests", label: "Join Requests", icon: "UserPlus", roles: ["admin"], group: "Run", section: "main" },
  { slug: "members", label: "Members", icon: "Users", roles: ["admin"], group: "Run", section: "main" },
  { slug: "instructors", label: "Instructors", icon: "GraduationCap", roles: ["admin"], group: "Run", section: "main" },
  { slug: "schedule", label: "Schedule", icon: "Calendar", roles: ["admin", "member"], group: "Run", section: "main" },
  { slug: "attendance", label: "Attendance", icon: "CheckSquare", roles: ["admin", "member"], group: "Run", section: "main" },
  { slug: "training", label: "Training Log", icon: "ClipboardList", roles: ["member"], group: "Run", section: "main" },
  { slug: "leaderboard", label: "Leaderboard", icon: "Award", roles: ["member"], group: "Run", section: "main" },
  // Grow
  { slug: "notifications", label: "Notifications", icon: "Bell", roles: ["admin", "member"], group: "Grow", section: "main" },
  { slug: "leads", pro: true, label: "Leads", icon: "Target", roles: ["admin"], group: "Grow", section: "main" },
  { slug: "dropins", pro: true, label: "Drop-ins", icon: "UserCheck", roles: ["admin"], group: "Grow", section: "main" },
  { slug: "announcements", label: "Announcements", icon: "Megaphone", roles: ["admin", "member"], group: "Grow", section: "main" },
  { slug: "activity", label: "Activity", icon: "Activity", roles: ["admin"], group: "Grow", section: "main" },
  { slug: "community", label: "Community", icon: "Users", roles: ["member"], group: "Grow", section: "main" },
  { slug: "nominate", label: "Nominate Gym", icon: "Megaphone", roles: ["member"], group: "Grow", section: "main" },
  // Content
  { slug: "videos", label: "Videos", icon: "Video", roles: ["admin", "member"], group: "Content", section: "main" },
  // Manage
  { slug: "analytics", label: "Analytics", icon: "BarChart3", roles: ["admin"], group: "Manage", section: "main" },
  { slug: "waivers", label: "Waivers", icon: "FileText", roles: ["admin"], group: "Manage", section: "main" },
  { slug: "events", pro: true, label: "Events", icon: "CalendarDays", roles: ["admin"], group: "Manage", section: "main" },
  { slug: "competitions", pro: true, label: "Competitions", icon: "Trophy", roles: ["admin"], group: "Manage", section: "main" },
  { slug: "waiver", label: "Waiver", icon: "FileSignature", roles: ["member"], group: "Manage", section: "main" },
  { slug: "profile", label: "Profile", icon: "UserCircle", roles: ["member"], group: "Manage", section: "main" },
  // Manage — pinned to the bottom of the desktop sidebar for quick reach
  { slug: "settings", label: "Settings", icon: "Settings", roles: ["admin"], group: "Manage", section: "bottom" },
  { slug: "billing", label: "Billing", icon: "CreditCard", roles: ["admin"], group: "Manage", section: "bottom" },
];

export const MOBILE_TABS: { slug: string; label: string; icon: string; roles: ("admin" | "member")[] }[] = [
  { slug: "", label: "Home", icon: "Home", roles: ["admin", "member"] },
  { slug: "schedule", label: "Schedule", icon: "Calendar", roles: ["admin", "member"] },
  { slug: "analytics", label: "Analytics", icon: "BarChart3", roles: ["admin"] },
];
