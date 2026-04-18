"use client";

import { useEffect, useState } from "react";

/**
 * 3.5s MatFlow logo launch animation.
 *
 * Plays once per session on cold app open (native Capacitor iOS app =
 * every launch, since WKWebView starts fresh each time). Skipped entirely
 * when the user has prefers-reduced-motion.
 *
 * Faithful to the handoff spec: black hold → three white bars draw in
 * left-to-right (staggered, easeOutQuart) → red plate scales in behind
 * (easeOutBack) → settle flash → wordmark wipes in (easeOutCubic) →
 * belt stripe paints segment-by-segment → ambient breath → fade out.
 */

const STAGE_W = 1080;
const STAGE_H = 1920;
const PLATE_CX = STAGE_W / 2;
const PLATE_CY = 780;
const PLATE_SIZE = 320;
const PLATE_RADIUS = 62;
const BAR_WIDTH = 180;
const BAR_HEIGHT = 24;
const BAR_GAP = 46;
const BAR_Y_OFFSETS = [-BAR_GAP, 0, BAR_GAP];
const RED = "#e53a2b";
const BELT_COLORS = ["#ffffff", "#2e6bd4", "#8a4fc9", "#8a5a2f", "#0a0a0a"];
const STRIPE_W = 640;
const STRIPE_H = 16;
const STRIPE_Y = PLATE_CY + PLATE_SIZE / 2 + 90 + 180;

const TOTAL_DURATION = 3.5; // seconds
const FADE_OUT_DURATION = 0.3; // post-animation fade to reveal page underneath
const SESSION_KEY = "matflow-launch-played";

const clamp = (v: number, min = 0, max = 1) => Math.min(Math.max(v, min), max);
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export default function LaunchAnimation() {
  const [visible, setVisible] = useState(false);
  const [time, setTime] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already played this session — skip entirely
    if (sessionStorage.getItem(SESSION_KEY)) return;

    // Respect prefers-reduced-motion: mark as played so it doesn't show,
    // and don't animate.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      sessionStorage.setItem(SESSION_KEY, "1");
      return;
    }

    sessionStorage.setItem(SESSION_KEY, "1");
    setVisible(true);

    const start = performance.now();
    let rafId = 0;

    function tick(now: number) {
      const elapsed = (now - start) / 1000;
      setTime(elapsed);
      if (elapsed >= TOTAL_DURATION) {
        setFadingOut(true);
        setTimeout(() => setVisible(false), FADE_OUT_DURATION * 1000);
        return;
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, []);

  if (!visible) return null;

  // ── Red plate ────────────────────────────────────────────────────────
  const plateT = clamp((time - 0.7) / 0.5);
  const plateEased = plateT > 0 ? easeOutBack(plateT) : 0;
  const plateScale = plateT > 0 ? 0.3 + 0.7 * plateEased : 0;
  const breath = time > 1.3 ? 1 + Math.sin((time - 1.3) * 2.2) * 0.006 : 1;
  const plateOpacity = clamp(plateT * 3);

  // ── Settle flash ─────────────────────────────────────────────────────
  const flashT = clamp((time - 1.2) / 0.18);
  const flashAlpha =
    flashT > 0 && flashT < 1
      ? flashT < 0.3
        ? flashT / 0.3
        : 1 - (flashT - 0.3) / 0.7
      : 0;

  // ── Wordmark ─────────────────────────────────────────────────────────
  const wordT = clamp((time - 1.4) / 0.7);
  const wordEased = wordT > 0 ? easeOutCubic(wordT) : 0;
  const wordClipPct = wordT * 100;
  const wordSlideY = (1 - wordEased) * 20;
  const wordOpacity = clamp(wordT * 2);
  const wordTop = PLATE_CY + PLATE_SIZE / 2 + 90;

  // ── Belt stripe ──────────────────────────────────────────────────────
  const beltT = clamp((time - 2.1) / 0.6);
  const beltEased = beltT > 0 ? easeOutCubic(beltT) : 0;
  const segW = STRIPE_W / BELT_COLORS.length;
  const startX = (STAGE_W - STRIPE_W) / 2;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none",
        background:
          "radial-gradient(ellipse at center, #141414 0%, #050505 60%, #000 100%)",
        opacity: fadingOut ? 0 : 1,
        transition: `opacity ${FADE_OUT_DURATION}s ease-out`,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <filter id="ml-plate-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="18" />
            <feOffset dx="0" dy="16" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.45" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="ml-settle-glow">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Red plate — renders below the bars */}
        {plateT > 0 && (
          <g
            transform={`translate(${PLATE_CX} ${PLATE_CY}) scale(${plateScale * breath})`}
            opacity={plateOpacity}
          >
            <rect
              x={-PLATE_SIZE / 2}
              y={-PLATE_SIZE / 2}
              width={PLATE_SIZE}
              height={PLATE_SIZE}
              rx={PLATE_RADIUS}
              ry={PLATE_RADIUS}
              fill={RED}
              filter="url(#ml-plate-shadow)"
            />
            {/* Inner bevel highlight */}
            <rect
              x={-PLATE_SIZE / 2 + 8}
              y={-PLATE_SIZE / 2 + 8}
              width={PLATE_SIZE - 16}
              height={PLATE_SIZE - 16}
              rx={PLATE_RADIUS - 10}
              ry={PLATE_RADIUS - 10}
              fill="none"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={1.5}
            />
          </g>
        )}

        {/* Three white bars */}
        {BAR_Y_OFFSETS.map((dy, i) => {
          const delay = 0.2 + i * 0.2;
          const dur = 0.45;
          const t = clamp((time - delay) / dur);
          if (t <= 0) return null;

          const drawT = easeOutQuart(t);
          const leftX = PLATE_CX - BAR_WIDTH / 2;
          const barY = PLATE_CY + dy;
          const headBulge = t < 0.75 ? 1 + (1 - t / 0.75) * 0.15 : 1;
          const currentW = BAR_WIDTH * drawT;
          const alpha = clamp(t * 3);

          return (
            <g key={i}>
              <rect
                x={leftX}
                y={barY - (BAR_HEIGHT * headBulge) / 2}
                width={currentW}
                height={BAR_HEIGHT * headBulge}
                rx={BAR_HEIGHT / 2}
                ry={BAR_HEIGHT / 2}
                fill="#ffffff"
                opacity={alpha}
              />
              {t < 0.75 && (
                <circle
                  cx={leftX + currentW}
                  cy={barY}
                  r={BAR_HEIGHT * 0.75}
                  fill="#ffffff"
                  opacity={(1 - t / 0.75) * 0.9}
                />
              )}
            </g>
          );
        })}

        {/* Ink particles trailing bar tips */}
        {BAR_Y_OFFSETS.map((dy, bar) => {
          const delay = 0.2 + bar * 0.2;
          const dur = 0.45;
          const t = clamp((time - delay) / dur);
          if (t <= 0 || t >= 0.9) return null;

          const leftX = PLATE_CX - BAR_WIDTH / 2;
          const barY = PLATE_CY + dy;

          const particles = [];
          for (let i = 0; i < 6; i++) {
            const age = i * 0.05;
            const pt = t - age;
            if (pt < 0) continue;
            const pDrawT = easeOutQuart(clamp(pt));
            const px = leftX + BAR_WIDTH * pDrawT;
            const py = barY - age * 60 + Math.sin(i * 1.3) * 4;
            const alpha = (1 - i / 6) * (1 - t) * 0.9;
            particles.push(
              <circle
                key={`${bar}-${i}`}
                cx={px}
                cy={py}
                r={3 - i * 0.3}
                fill="#ffffff"
                opacity={alpha}
              />
            );
          }
          return <g key={`p-${bar}`}>{particles}</g>;
        })}

        {/* Settle flash radial glow */}
        {flashAlpha > 0 && (
          <circle
            cx={PLATE_CX}
            cy={PLATE_CY}
            r={300 + flashT * 400}
            fill="url(#ml-settle-glow)"
            opacity={flashAlpha}
          />
        )}

        {/* Belt stripe */}
        {beltT > 0 && (
          <>
            {BELT_COLORS.map((c, i) => {
              const segStart = i / BELT_COLORS.length;
              const segEnd = (i + 1) / BELT_COLORS.length;
              const segT = clamp((beltEased - segStart) / (segEnd - segStart));
              if (segT <= 0) return null;
              return (
                <rect
                  key={i}
                  x={startX + i * segW}
                  y={STRIPE_Y - STRIPE_H / 2}
                  width={segW * segT}
                  height={STRIPE_H}
                  fill={c}
                />
              );
            })}
            {/* Hairline above the white segment so it's visible on dark bg */}
            <rect
              x={startX}
              y={STRIPE_Y - STRIPE_H / 2 - 0.5}
              width={segW * clamp(beltEased / (1 / BELT_COLORS.length))}
              height={1}
              fill="rgba(255,255,255,0.3)"
            />
          </>
        )}
      </svg>

      {/* Full-screen white flash — DOM layer on top of SVG */}
      {flashAlpha > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#ffffff",
            opacity: flashAlpha * 0.35,
          }}
        />
      )}

      {/* Wordmark — DOM for crisper font rendering than SVG text */}
      {wordT > 0 && (
        // Wordmark is positioned in stage-space coordinates to match the SVG
        // above. The outer div uses the stage viewBox aspect to map correctly.
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: `${(wordTop / STAGE_H) * 100}%`,
              width: "100%",
              textAlign: "center",
              color: "#ffffff",
              fontFamily: "Inter, system-ui, -apple-system, sans-serif",
              fontSize: "clamp(48px, 13.7vw, 148px)",
              fontWeight: 800,
              letterSpacing: "-0.035em",
              lineHeight: 1,
              transform: `translateY(${wordSlideY}px)`,
              opacity: wordOpacity,
              clipPath: `inset(0 ${100 - wordClipPct}% 0 0)`,
              WebkitClipPath: `inset(0 ${100 - wordClipPct}% 0 0)`,
            }}
          >
            MatFlow
          </div>
        </div>
      )}
    </div>
  );
}
