/**
 * Academy brand-color safety.
 *
 * Owners choose their academy's primary color. That stored value is theirs and
 * is never rewritten — but a dark brand color rendered as text on the kiosk's
 * near-black background can be unreadable. These helpers derive a display-safe
 * color AT RENDER TIME while leaving the saved branding untouched.
 *
 * Pure functions only: no DB, no React, no environment access.
 */

/** MatFlow's established default academy color (used for invalid legacy values). */
export const DEFAULT_BRAND_COLOR = "#c4b5a0";

/** The kiosk canvas. Contrast for kiosk text is measured against this. */
export const KIOSK_BACKGROUND = "#080808";

/** WCAG AA for normal-size text. */
export const MIN_CONTRAST = 4.5;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Accepts `#rgb` and `#rrggbb` (leading `#` optional, case-insensitive) and
 * returns the canonical lowercase 6-digit form, or null when unusable.
 */
export function normalizeHex(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(raw)) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
  }
  if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`;
  return null;
}

export function hexToRgb(hex: string): Rgb | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

/** WCAG 2.x relative luminance (sRGB). */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** WCAG contrast ratio between two colors (1–21). Invalid input yields 1. */
export function contrastRatio(a: string, b: string): number {
  if (!normalizeHex(a) || !normalizeHex(b)) return 1;
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Black or white text for a colored background, whichever reads better. */
export function readableTextColor(background: string): "#000000" | "#ffffff" {
  return contrastRatio(background, "#000000") >= contrastRatio(background, "#ffffff")
    ? "#000000"
    : "#ffffff";
}

function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Blend toward white (amount > 0) or black (amount < 0), keeping hue. */
function blend(rgb: Rgb, amount: number): Rgb {
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return {
    r: rgb.r + (target - rgb.r) * t,
    g: rgb.g + (target - rgb.g) * t,
    b: rgb.b + (target - rgb.b) * t,
  };
}

/**
 * A version of the academy color that is legible as text/iconography on
 * `background`, preserving hue.
 *
 * - Invalid or missing input falls back to the MatFlow default.
 * - A color that already meets `minContrast` is returned unchanged (normalized).
 * - Otherwise the color is blended AWAY from the background in small steps
 *   (lighter on a dark background, darker on a light one) until it clears the
 *   bar; pure white or black is the final guaranteed fallback.
 */
export function accessibleAccent(
  color: string | null | undefined,
  background: string = KIOSK_BACKGROUND,
  minContrast: number = MIN_CONTRAST,
): string {
  const normalized = normalizeHex(color) ?? DEFAULT_BRAND_COLOR;
  const bg = normalizeHex(background) ?? KIOSK_BACKGROUND;

  if (contrastRatio(normalized, bg) >= minContrast) return normalized;

  const rgb = hexToRgb(normalized);
  const backgroundIsDark = relativeLuminance(bg) < 0.5;
  const extreme = backgroundIsDark ? "#ffffff" : "#000000";
  if (!rgb) return extreme;

  const direction = backgroundIsDark ? 1 : -1;
  for (let step = 1; step <= 20; step++) {
    const candidate = rgbToHex(blend(rgb, (direction * step) / 20));
    if (contrastRatio(candidate, bg) >= minContrast) return candidate;
  }
  return extreme;
}

/** True when the value is a hex color this app can store and render. */
export function isValidBrandColor(value: unknown): value is string {
  return typeof value === "string" && normalizeHex(value) !== null;
}
