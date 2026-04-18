/**
 * Fixed 1290×2796 (6.7" iPhone) marketing frame. Background vignette,
 * top headline, center phone mockup, bottom MatFlow attribution.
 *
 * When viewing in Chrome DevTools device mode set the viewport to exactly
 * 1290 × 2796 and capture the node. No safe-area padding, no scrollbar.
 */

function MockTabBar() {
  const tabs = [
    { label: "Home", icon: "⌂", active: false },
    { label: "Inbox", icon: "◈", active: false },
    { label: "Schedule", icon: "▦", active: false },
    { label: "Log", icon: "≡", active: true },
    { label: "More", icon: "⋯", active: false },
  ];
  return (
    <div
      style={{
        borderTop: "1px solid rgba(255,255,255,0.08)",
        background: "#0a0a0a",
        padding: "14px 0 26px 0",
        display: "flex",
        justifyContent: "space-around",
      }}
    >
      {tabs.map((t) => (
        <div
          key={t.label}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            color: t.active ? "#dc2626" : "#6b6b6b",
          }}
        >
          <div style={{ fontSize: 22, lineHeight: 1 }}>{t.icon}</div>
          <div style={{ fontSize: 10, fontWeight: 600 }}>{t.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function ScreenshotFrame({
  eyebrow,
  headline,
  sub,
  children,
}: {
  eyebrow: string;
  headline: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: 1290,
        height: 2796,
        margin: 0,
        padding: 0,
        overflow: "hidden",
        position: "relative",
        background:
          "radial-gradient(ellipse at 50% 30%, #2a0505 0%, #0a0a0a 50%, #000 100%)",
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        color: "white",
      }}
    >
      {/* Headline band */}
      <div style={{ textAlign: "center", paddingTop: 120 }}>
        <div
          style={{
            display: "inline-block",
            fontSize: 26,
            color: "#dc2626",
            letterSpacing: 6,
            textTransform: "uppercase",
            fontWeight: 800,
            marginBottom: 18,
          }}
        >
          {eyebrow}
        </div>
        <h1
          style={{
            fontSize: 118,
            fontWeight: 900,
            letterSpacing: -3.5,
            lineHeight: 0.95,
            margin: 0,
            whiteSpace: "pre-line",
          }}
        >
          {headline}
        </h1>
        <p
          style={{
            fontSize: 32,
            color: "#aaaaaa",
            marginTop: 28,
            marginBottom: 0,
            fontWeight: 500,
          }}
        >
          {sub}
        </p>
      </div>

      {/* Phone frame + app mockup — true iPhone 19.5:9 aspect ratio */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 810,
          transform: "translateX(-50%)",
          width: 920,
          height: 1780,
          background: "#0a0a0a",
          borderRadius: 84,
          padding: 16,
          border: "8px solid #1a1a1a",
          boxShadow:
            "0 40px 140px rgba(220,38,38,0.14), 0 10px 40px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}
      >
        {/* iPhone notch */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 20,
            transform: "translateX(-50%)",
            width: 260,
            height: 36,
            background: "#000",
            borderRadius: 20,
            zIndex: 2,
          }}
        />

        {/* Inner screen — reserve bottom 120px for mock tab bar */}
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#080808",
            borderRadius: 68,
            overflow: "hidden",
            position: "relative",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ paddingTop: 70, flex: 1, overflow: "hidden" }}>{children}</div>

          {/* Mock bottom tab bar — matches real app */}
          <MockTabBar />
        </div>
      </div>

      {/* footer logo mark injected below */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          textAlign: "center",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            background: "#dc2626",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ width: 30, height: 5, background: "white", borderRadius: 1 }} />
          <div style={{ width: 22, height: 5, background: "white", borderRadius: 1 }} />
          <div style={{ width: 30, height: 5, background: "white", borderRadius: 1 }} />
        </div>
        <div>
          <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: -1, color: "white" }}>MatFlow</div>
          <div
            style={{
              marginTop: 4,
              display: "inline-flex",
              height: 10,
              width: 150,
              border: "1px solid rgba(255,255,255,0.35)",
            }}
          >
            <div style={{ flex: 1, background: "white" }} />
            <div style={{ flex: 1, background: "#2e6bd4" }} />
            <div style={{ flex: 1, background: "#7c3aed" }} />
            <div style={{ flex: 1, background: "#8a5a2f" }} />
            <div style={{ flex: 1, background: "#000" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
