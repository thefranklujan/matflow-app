export interface NavItem {
  slug: string;
  label: string;
  icon: string;
  roles: ("admin" | "member")[];
  section?: "main" | "bottom";
}

export const NAV_ITEMS: NavItem[] = [
  // Admin-only
  { slug: "activity", label: "Activity", icon: "Activity", roles: ["admin"], section: "main" },
  { slug: "analytics", label: "Analytics", icon: "BarChart3", roles: ["admin"], section: "main" },
  { slug: "leads", label: "Leads", icon: "Target", roles: ["admin"], section: "main" },
  { slug: "requests", label: "Join Requests", icon: "UserPlus", roles: ["admin"], section: "main" },
  { slug: "members", label: "Members", icon: "Users", roles: ["admin"], section: "main" },
  // Shared
  { slug: "schedule", label: "Schedule", icon: "Calendar", roles: ["admin", "member"], section: "main" },
  { slug: "attendance", label: "Attendance", icon: "CheckSquare", roles: ["admin", "member"], section: "main" },
  { slug: "videos", label: "Videos", icon: "Video", roles: ["admin", "member"], section: "main" },
  // Admin-only
  { slug: "products", label: "Products", icon: "Package", roles: ["admin"], section: "main" },
  { slug: "orders", label: "Orders", icon: "ShoppingBag", roles: ["admin"], section: "main" },
  { slug: "inventory", label: "Inventory", icon: "ClipboardList", roles: ["admin"], section: "main" },
  { slug: "announcements", label: "Announcements", icon: "Megaphone", roles: ["admin", "member"], section: "main" },
  { slug: "waivers", label: "Waivers", icon: "FileText", roles: ["admin"], section: "main" },
  { slug: "events", label: "Events", icon: "CalendarDays", roles: ["admin"], section: "main" },
  { slug: "competitions", label: "Competitions", icon: "Trophy", roles: ["admin"], section: "main" },
  // Member-only
  { slug: "training", label: "Training Log", icon: "ClipboardList", roles: ["member"], section: "main" },
  { slug: "community", label: "Community", icon: "Users", roles: ["member"], section: "main" },
  { slug: "nominate", label: "Nominate Gym", icon: "Megaphone", roles: ["member"], section: "main" },
  { slug: "leaderboard", label: "Leaderboard", icon: "Award", roles: ["member"], section: "main" },
  { slug: "waiver", label: "Waiver", icon: "FileSignature", roles: ["member"], section: "main" },
  { slug: "profile", label: "Profile", icon: "UserCircle", roles: ["member"], section: "main" },
  // Admin bottom section
  { slug: "settings", label: "Settings", icon: "Settings", roles: ["admin"], section: "bottom" },
  { slug: "billing", label: "Billing", icon: "CreditCard", roles: ["admin"], section: "bottom" },
];

export const MOBILE_TABS: { slug: string; label: string; icon: string; roles: ("admin" | "member")[] }[] = [
  { slug: "", label: "Home", icon: "Home", roles: ["admin", "member"] },
  { slug: "schedule", label: "Schedule", icon: "Calendar", roles: ["admin", "member"] },
  { slug: "analytics", label: "Analytics", icon: "BarChart3", roles: ["admin"] },
];
