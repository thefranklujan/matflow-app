/**
 * App Store marketing screenshots — rendered at exactly 1290×2796 (6.7" iPhone).
 *
 * Navigate to /app-store/1 through /app-store/5 in Chrome, then either:
 *   1) Use Chrome DevTools → Device Toolbar → set 1290×2796 → Capture node screenshot, or
 *   2) Run `npm run screenshots` which drives puppeteer over this route to generate
 *      the 5 PNGs in /public/app-store-screenshots/.
 *
 * Each page tells a different feature story. Kept deliberately simple — phone-frame
 * mockup + marketing headline + MatFlow mark. Palette matches the real app.
 */

import { notFound } from "next/navigation";
import ScreenshotFrame from "./ScreenshotFrame";

const SCREENS: Array<{
  eyebrow: string;
  headline: string;
  sub: string;
  body: React.ReactNode;
}> = [
  {
    eyebrow: "Training Log",
    headline: "Every session.\nEvery roll.",
    sub: "One-tap logging. Real belt progression.",
    body: <HomeMock />,
  },
  {
    eyebrow: "Session Detail",
    headline: "Track what clicked.",
    sub: "Techniques, partners, rolls won.",
    body: <LogMock />,
  },
  {
    eyebrow: "Your Week",
    headline: "Never miss\na class again.",
    sub: "Live schedule, right from your gym.",
    body: <ScheduleMock />,
  },
  {
    eyebrow: "Community",
    headline: "Roll with\nyour team.",
    sub: "Leaderboards, streaks, partners.",
    body: <CommunityMock />,
  },
  {
    eyebrow: "For Owners",
    headline: "Run your\nmats.",
    sub: "Students, schedule, pro shop — one dashboard.",
    body: <OwnerMock />,
  },
];

export default async function AppStoreScreenshot({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const { n } = await params;
  const idx = parseInt(n, 10) - 1;
  const screen = SCREENS[idx];
  if (!screen) notFound();

  return (
    <ScreenshotFrame eyebrow={screen.eyebrow} headline={screen.headline} sub={screen.sub}>
      {screen.body}
    </ScreenshotFrame>
  );
}

// ── Mockups: simplified app screens, rendered for marketing impact ────────

function BeltBar({ belt = "blue", stripes = 2, size = "md" }: { belt?: string; stripes?: number; size?: "sm" | "md" }) {
  const colors: Record<string, string> = {
    white: "#ffffff",
    blue: "#2e6bd4",
    purple: "#7c3aed",
    brown: "#8a5a2f",
    black: "#0a0a0a",
  };
  const h = size === "sm" ? 16 : 20;
  const w = size === "sm" ? 68 : 90;
  const box = size === "sm" ? 28 : 36;
  const stripeH = size === "sm" ? 10 : 14;
  return (
    <div style={{ display: "inline-flex", alignItems: "stretch", height: h, width: w, borderRadius: 3, overflow: "hidden", border: "1px solid rgba(255,255,255,0.6)" }}>
      <div style={{ flex: 1, background: colors[belt] }} />
      <div style={{ width: box, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
        {Array.from({ length: stripes }).map((_, i) => (
          <div key={i} style={{ width: 3, height: stripeH, background: "white", borderRadius: 1 }} />
        ))}
      </div>
    </div>
  );
}

function Heatmap() {
  // 14 x 13 grid of intensity values — GitHub-style, deliberately sparse
  // so it reads as "real activity" not solid red blocks. Weighted so ~55%
  // of cells are empty, matching what realistic training-week data looks like.
  const cells = Array.from({ length: 14 * 13 }).map((_, i) => {
    const r = Math.abs(Math.sin(i * 12.9898 + i * 0.71) * 43758.5453) % 1;
    if (r < 0.55) return 0;
    if (r < 0.78) return 1;
    if (r < 0.92) return 2;
    return 3;
  });
  const shade = (v: number) => {
    if (v === 0) return "#1a1a1a";
    if (v === 1) return "#4a1818";
    if (v === 2) return "#8e1e1c";
    return "#dc2626";
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 5, padding: 16 }}>
      {cells.map((v, i) => (
        <div key={i} style={{ aspectRatio: "1/1", background: shade(v), borderRadius: 4 }} />
      ))}
    </div>
  );
}

function HomeMock() {
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: "white", letterSpacing: -0.8 }}>Hey Frank</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BeltBar belt="blue" stripes={2} />
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#dc2626", color: "white", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>FL</div>
        </div>
      </div>

      <div style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>Last 90 Days</div>
          <div style={{ fontSize: 13, color: "#888" }}>42 sessions</div>
        </div>
        <Heatmap />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4, fontSize: 11, color: "#666" }}>
          <span>Less</span>
          <div style={{ display: "flex", gap: 3 }}>
            <div style={{ width: 14, height: 14, background: "#1f1f1f", borderRadius: 3 }} />
            <div style={{ width: 14, height: 14, background: "#5a1f1f", borderRadius: 3 }} />
            <div style={{ width: 14, height: 14, background: "#a8201e", borderRadius: 3 }} />
            <div style={{ width: 14, height: 14, background: "#dc2626", borderRadius: 3 }} />
          </div>
          <span>More</span>
        </div>
      </div>

      <div style={{ background: "linear-gradient(90deg, rgba(249,115,22,0.2), rgba(220,38,38,0.1))", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 18, padding: 18, display: "flex", gap: 14, alignItems: "center" }}>
        <div style={{ width: 54, height: 54, borderRadius: 12, background: "rgba(249,115,22,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🔥</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "#fdba74", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Active Streak</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "white" }}>12 days</div>
          <div style={{ fontSize: 12, color: "#999" }}>Longest: 28 days · 14 this month</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <StatTile label="Sessions" value="42" />
        <StatTile label="Hours" value="48" />
        <StatTile label="Rolls" value="186" />
        <StatTile label="Win %" value="58%" accent="#dc2626" />
      </div>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 10, color: "#777", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent || "white", marginTop: 4 }}>{value}</div>
    </div>
  );
}

function LogMock() {
  const sessions = [
    { date: "Wed, Apr 16", type: "GI", duration: "75 min", w: 3, l: 1, tech: "Knee slice, spider guard sweep", partners: "Marcus, Diego" },
    { date: "Sun, Apr 13", type: "NO-GI", duration: "60 min", w: 2, l: 2, tech: "RNC, body lock takedown", partners: "Sara, Jamal" },
    { date: "Thu, Apr 10", type: "OPEN MAT", duration: "90 min", w: 4, l: 3, tech: "Half guard retention, X-guard", partners: "Diego, Marcus, Chen" },
    { date: "Mon, Apr 7", type: "GI", duration: "60 min", w: 2, l: 1, tech: "Arm drag, De la Riva guard", partners: "Jamal" },
    { date: "Fri, Apr 4", type: "DRILL", duration: "60 min", w: 0, l: 0, tech: "Mount escapes", partners: "Marcus" },
    { date: "Wed, Apr 2", type: "GI", duration: "75 min", w: 3, l: 2, tech: "Collar choke, scissor sweep", partners: "Sara, Diego" },
  ];
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: "white", letterSpacing: -0.8 }}>Training Log</div>
        <div style={{ background: "#dc2626", color: "white", padding: "9px 16px", borderRadius: 11, fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>+ Log</div>
      </div>

      {/* Stat summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        {[
          { l: "Sessions", v: "42" },
          { l: "Hours", v: "48" },
          { l: "Rolls", v: "186" },
          { l: "Win %", v: "58%", a: "#dc2626" },
        ].map((s) => (
          <div key={s.l} style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 10 }}>
            <div style={{ fontSize: 9, color: "#777", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>{s.l}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.a || "white", marginTop: 2 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {sessions.map((s, i) => (
        <div key={i} style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "white" }}>{s.date}</div>
            <div style={{ background: "rgba(255,255,255,0.05)", color: "#dc2626", padding: "3px 9px", borderRadius: 5, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{s.type}</div>
            <div style={{ color: "#aaa", fontSize: 11 }}>🕑 {s.duration}</div>
            {(s.w + s.l > 0) && (
              <div style={{ color: "#aaa", fontSize: 11 }}>⚔ {s.w}W · {s.l}L</div>
            )}
          </div>
          <div style={{ color: "#ddd", fontSize: 13, marginBottom: 3 }}>{s.tech}</div>
          <div style={{ color: "#777", fontSize: 11 }}>Partners: {s.partners}</div>
        </div>
      ))}
    </div>
  );
}

function ScheduleMock() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = 2; // wed
  const classes = [
    { time: "6:00 AM", name: "Fundamentals Gi", coach: "Coach Ceconi", attending: 14, rsvp: true },
    { time: "12:00 PM", name: "Open Mat", coach: "Coach Diego", attending: 8, rsvp: false },
    { time: "4:30 PM", name: "Competition Class", coach: "Coach Ceconi", attending: 9, rsvp: false },
    { time: "6:30 PM", name: "Advanced No-Gi", coach: "Coach Ceconi", attending: 22, rsvp: true, hot: true },
    { time: "7:30 PM", name: "Fundamentals No-Gi", coach: "Coach Diego", attending: 18, rsvp: false },
    { time: "8:00 PM", name: "Kids BJJ", coach: "Coach Sara", attending: 11, rsvp: false },
  ];
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 30, fontWeight: 800, color: "white", letterSpacing: -0.8 }}>Schedule</div>
        <div style={{ color: "#888", fontSize: 15, marginTop: 4 }}>Wednesday · April 16</div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
        {days.map((d, i) => (
          <div key={d} style={{ flex: 1, background: i === today ? "#dc2626" : "#0a0a0a", border: i === today ? "none" : "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "14px 0", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: i === today ? "rgba(255,255,255,0.75)" : "#777", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>{d}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "white", marginTop: 4 }}>{14 + i}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {classes.map((c, i) => (
          <div key={i} style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 14, display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ textAlign: "center", width: 62 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "white" }}>{c.time.split(" ")[0]}</div>
              <div style={{ fontSize: 9, color: "#777", fontWeight: 700 }}>{c.time.split(" ")[1]}</div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.1)", alignSelf: "stretch" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "white", marginBottom: 2 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: "#888" }}>{c.coach} · {c.attending} attending {c.hot && "🔥"}</div>
            </div>
            {c.rsvp ? (
              <div style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", padding: "6px 11px", borderRadius: 8, fontSize: 10, fontWeight: 700 }}>✓ Going</div>
            ) : (
              <div style={{ border: "1px solid rgba(255,255,255,0.15)", color: "#ddd", padding: "6px 11px", borderRadius: 8, fontSize: 10, fontWeight: 700 }}>Attend</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CommunityMock() {
  const people = [
    { name: "Marcus Chen", streak: 23, hours: 64, belt: "purple", stripes: 1, rank: 1 },
    { name: "Sara Okafor", streak: 18, hours: 58, belt: "blue", stripes: 3, rank: 2 },
    { name: "Diego Alvarez", streak: 15, hours: 56, belt: "blue", stripes: 2, rank: 3 },
    { name: "Frank Lujan", streak: 12, hours: 48, belt: "blue", stripes: 2, rank: 4, me: true },
    { name: "Jamal Peterson", streak: 10, hours: 42, belt: "white", stripes: 4, rank: 5 },
    { name: "Chen Wei", streak: 8, hours: 36, belt: "white", stripes: 3, rank: 6 },
    { name: "Leila Farooqi", streak: 7, hours: 32, belt: "white", stripes: 3, rank: 7 },
    { name: "Dominic Reyes", streak: 5, hours: 28, belt: "white", stripes: 2, rank: 8 },
    { name: "Kenji Takamura", streak: 4, hours: 24, belt: "white", stripes: 1, rank: 9 },
  ];
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={{ fontSize: 30, fontWeight: 800, color: "white", letterSpacing: -0.8 }}>Leaderboard</div>
        <div style={{ color: "#888", fontSize: 14, marginTop: 4 }}>MatFlow Demo Academy · This month</div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {["Streak", "Hours", "Rolls"].map((t, i) => (
          <div key={t} style={{ flex: 1, background: i === 0 ? "#dc2626" : "#0a0a0a", border: i === 0 ? "none" : "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 0", textAlign: "center", fontSize: 13, fontWeight: 700, color: "white" }}>
            {t}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {people.map((p) => (
          <div key={p.rank} style={{ background: p.me ? "rgba(220,38,38,0.08)" : "#0a0a0a", border: p.me ? "1px solid rgba(220,38,38,0.3)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: p.rank <= 3 ? ["#f59e0b", "#9ca3af", "#b45309"][p.rank - 1] : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 13 }}>{p.rank}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: "white", fontWeight: 600 }}>{p.name}{p.me && <span style={{ color: "#dc2626", fontSize: 9, marginLeft: 6, fontWeight: 700, letterSpacing: 1 }}>YOU</span>}</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 1, display: "flex", alignItems: "center", gap: 6 }}>
                <span>🔥 {p.streak}d</span>
                <span>·</span>
                <span>{p.hours}h</span>
              </div>
            </div>
            <BeltBar belt={p.belt} stripes={p.stripes} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

function OwnerMock() {
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={{ fontSize: 12, color: "#dc2626", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>Owner Dashboard</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: "white", letterSpacing: -0.8, marginTop: 3 }}>Good morning,{"\n"}Gabriela</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: "linear-gradient(135deg, rgba(220,38,38,0.2), rgba(220,38,38,0.05))", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 10, color: "#fca5a5", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Active Students</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "white", marginTop: 4 }}>87</div>
          <div style={{ fontSize: 11, color: "#4ade80", marginTop: 2 }}>↑ 12 this month</div>
        </div>
        <div style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 10, color: "#777", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Attendance Today</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "white", marginTop: 4 }}>31</div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>across 3 classes</div>
        </div>
      </div>

      <div style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>Pending Join Requests</div>
          <div style={{ background: "#dc2626", color: "white", padding: "4px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700 }}>3 new</div>
        </div>
        {["Kenji Takamura", "Leila Farooqi", "Dominic Reyes"].map((name, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(220,38,38,0.15)", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>{name.split(" ").map((p) => p[0]).join("")}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: "white", fontWeight: 600 }}>{name}</div>
              <div style={{ fontSize: 11, color: "#888" }}>wants to join your gym</div>
            </div>
            <div style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", padding: "7px 11px", borderRadius: 9, fontSize: 11, fontWeight: 700 }}>Approve</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "white", marginBottom: 10 }}>Today&apos;s Classes</div>
        {[
          { time: "6:00 AM", name: "Fundamentals Gi", cnt: 14 },
          { time: "12:00 PM", name: "Open Mat", cnt: 8 },
          { time: "6:30 PM", name: "Advanced No-Gi", cnt: 22 },
          { time: "8:00 PM", name: "Kids BJJ", cnt: 11 },
        ].map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            <div style={{ fontSize: 11, color: "#888", fontWeight: 700, width: 68 }}>{c.time}</div>
            <div style={{ flex: 1, fontSize: 13, color: "white" }}>{c.name}</div>
            <div style={{ fontSize: 11, color: "#aaa" }}>{c.cnt} going</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "white", marginBottom: 10 }}>Recent Promotions</div>
        {[
          { name: "Marcus Chen", from: "blue-1", to: "blue-2" },
          { name: "Sara Okafor", from: "blue-2", to: "blue-3" },
          { name: "Diego Alvarez", from: "blue-1", to: "blue-2" },
        ].map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(37,99,235,0.15)", color: "#60a5fa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{p.name.split(" ").map((x) => x[0]).join("")}</div>
            <div style={{ flex: 1, fontSize: 13, color: "white" }}>{p.name}</div>
            <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Promoted</div>
          </div>
        ))}
      </div>
    </div>
  );
}
