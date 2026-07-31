import { describe, it, expect } from "vitest";
import {
  DEFAULT_BRAND_COLOR,
  KIOSK_BACKGROUND,
  MIN_CONTRAST,
  accessibleAccent,
  contrastRatio,
  hexToRgb,
  isValidBrandColor,
  normalizeHex,
  readableTextColor,
  relativeLuminance,
} from "./brand-color";

describe("normalizeHex", () => {
  it("accepts 6-digit hex with or without #, any case", () => {
    expect(normalizeHex("#C4B5A0")).toBe("#c4b5a0");
    expect(normalizeHex("c4b5a0")).toBe("#c4b5a0");
    expect(normalizeHex("  #0FE69B  ")).toBe("#0fe69b");
  });

  it("expands supported shorthand", () => {
    expect(normalizeHex("#f00")).toBe("#ff0000");
    expect(normalizeHex("abc")).toBe("#aabbcc");
  });

  it("rejects anything else", () => {
    for (const bad of ["", "   ", "#12", "#12345", "#1234567", "rgb(1,2,3)", "red", "#gggggg", null, undefined, 123 as unknown as string]) {
      expect(normalizeHex(bad as string), String(bad)).toBeNull();
    }
  });
});

describe("luminance and contrast", () => {
  it("anchors at the WCAG extremes", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("is symmetric and invalid-safe", () => {
    expect(contrastRatio("#c4b5a0", "#080808")).toBeCloseTo(contrastRatio("#080808", "#c4b5a0"), 10);
    expect(contrastRatio("nope", "#000000")).toBe(1);
  });

  it("hexToRgb parses channels", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#080808")).toEqual({ r: 8, g: 8, b: 8 });
    expect(hexToRgb("bogus")).toBeNull();
  });
});

describe("readableTextColor", () => {
  it("picks black on light backgrounds and white on dark", () => {
    expect(readableTextColor("#ffffff")).toBe("#000000");
    expect(readableTextColor("#c4b5a0")).toBe("#000000"); // MatFlow tan
    expect(readableTextColor("#000000")).toBe("#ffffff");
    expect(readableTextColor("#dc2626")).toBe("#ffffff"); // saturated red
  });

  it("always returns a choice that meets AA against its background", () => {
    for (const bg of ["#ffffff", "#000000", "#c4b5a0", "#dc2626", "#0fe69b", "#080808"]) {
      expect(contrastRatio(bg, readableTextColor(bg)), bg).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
});

describe("accessibleAccent (kiosk background)", () => {
  it("returns a color meeting AA for every tested academy brand", () => {
    const brands = [
      "#000000", // black: the worst case on a near-black kiosk
      "#ffffff",
      DEFAULT_BRAND_COLOR, // MatFlow tan
      "#dc2626", // saturated red
      "#0fe69b", // bright green
      "#1a1a2e", // very dark navy (dark academy fixture)
      "#f5f5dc", // beige (light academy fixture)
      "#7c3aed", // purple, borderline on dark
    ];
    for (const brand of brands) {
      const safe = accessibleAccent(brand);
      expect(contrastRatio(safe, KIOSK_BACKGROUND), `${brand} -> ${safe}`).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  it("leaves an already-accessible color untouched (normalized only)", () => {
    expect(contrastRatio(DEFAULT_BRAND_COLOR, KIOSK_BACKGROUND)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(accessibleAccent("#C4B5A0")).toBe("#c4b5a0");
    expect(accessibleAccent("#ffffff")).toBe("#ffffff");
  });

  it("lightens a too-dark color instead of discarding its hue", () => {
    const safe = accessibleAccent("#7c3aed");
    expect(safe).not.toBe("#7c3aed");
    // Still purple-dominant: blue channel stays the strongest.
    const rgb = hexToRgb(safe)!;
    expect(rgb.b).toBeGreaterThan(rgb.g);
    expect(contrastRatio(safe, KIOSK_BACKGROUND)).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it("black is lifted to a legible grey rather than staying invisible", () => {
    const safe = accessibleAccent("#000000");
    expect(safe).not.toBe("#000000");
    expect(contrastRatio(safe, KIOSK_BACKGROUND)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    // Meaningfully lighter than the kiosk canvas, not a near-black.
    expect(relativeLuminance(safe)).toBeGreaterThan(relativeLuminance(KIOSK_BACKGROUND) + 0.1);
  });

  it("falls back to the MatFlow default for invalid or missing values", () => {
    for (const bad of [null, undefined, "", "not-a-color", "#12345"]) {
      expect(accessibleAccent(bad as string | null)).toBe(DEFAULT_BRAND_COLOR);
    }
  });

  it("honors a custom background and threshold", () => {
    // Against white, the tan default is NOT accessible and must change.
    const onWhite = accessibleAccent(DEFAULT_BRAND_COLOR, "#ffffff");
    expect(contrastRatio(onWhite, "#ffffff")).toBeGreaterThanOrEqual(MIN_CONTRAST);
    // A lower bar keeps the original color.
    expect(accessibleAccent("#7c3aed", KIOSK_BACKGROUND, 1.5)).toBe("#7c3aed");
  });

  it("near-threshold cases resolve on the passing side", () => {
    // Find a color sitting just under AA on the kiosk background.
    const justUnder = "#6b6b6b";
    expect(contrastRatio(justUnder, KIOSK_BACKGROUND)).toBeLessThan(MIN_CONTRAST);
    expect(contrastRatio(accessibleAccent(justUnder), KIOSK_BACKGROUND)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    // And one sitting just over: unchanged.
    const justOver = "#767676";
    if (contrastRatio(justOver, KIOSK_BACKGROUND) >= MIN_CONTRAST) {
      expect(accessibleAccent(justOver)).toBe(justOver);
    }
  });
});

describe("isValidBrandColor", () => {
  it("accepts storable colors and rejects everything else", () => {
    expect(isValidBrandColor("#fff")).toBe(true);
    expect(isValidBrandColor("#c4b5a0")).toBe(true);
    expect(isValidBrandColor("javascript:alert(1)")).toBe(false);
    expect(isValidBrandColor("")).toBe(false);
    expect(isValidBrandColor(null)).toBe(false);
    expect(isValidBrandColor(42)).toBe(false);
    expect(isValidBrandColor({ hex: "#fff" })).toBe(false);
  });
});
