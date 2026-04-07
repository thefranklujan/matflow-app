"use client";

const BELT_COLORS: Record<string, string> = {
  white: "#FFFFFF",
  blue: "#1E40AF",
  purple: "#7C3AED",
  brown: "#92400E",
  black: "#1a1a1a",
};

// Traditional BJJ belt tip color (the section where stripes go)
const BELT_TIP_COLORS: Record<string, string> = {
  white: "#1a1a1a",  // black tip on white belt
  blue: "#1a1a1a",
  purple: "#1a1a1a",
  brown: "#1a1a1a",
  black: "#B91C1C",  // red tip on black belt
};

// Stripe color: white on colored belts, black on white belt
const STRIPE_COLORS: Record<string, string> = {
  white: "#1a1a1a",
  blue: "#FFFFFF",
  purple: "#FFFFFF",
  brown: "#FFFFFF",
  black: "#FFFFFF",
};

const BELT_TEXT_COLORS: Record<string, string> = {
  white: "text-gray-900",
  blue: "text-white",
  purple: "text-white",
  brown: "text-white",
  black: "text-white",
};

interface BeltDisplayProps {
  beltRank: string;
  stripes: number;
  size?: "sm" | "md" | "lg";
}

export default function BeltDisplay({
  beltRank,
  stripes,
  size = "md",
}: BeltDisplayProps) {
  const beltColor = BELT_COLORS[beltRank] || BELT_COLORS.white;
  const tipColor = BELT_TIP_COLORS[beltRank] || "#1a1a1a";
  const stripeColor = STRIPE_COLORS[beltRank] || "#FFFFFF";
  const textColor = BELT_TEXT_COLORS[beltRank] || "text-white";

  const sizeClasses = {
    sm: "h-6 text-xs",
    md: "h-10 text-sm",
    lg: "h-14 text-base",
  };

  const stripeSizes = {
    sm: "w-1 h-4",
    md: "w-1.5 h-6",
    lg: "w-2 h-9",
  };

  const tipWidth = { sm: "w-12", md: "w-16", lg: "w-20" }[size];

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div
        className={`${sizeClasses[size]} rounded-md flex items-stretch min-w-[140px] border border-white/20 overflow-hidden`}
        style={{ backgroundColor: beltColor }}
      >
        <span
          className={`flex-1 flex items-center px-4 font-semibold uppercase tracking-wider ${textColor}`}
        >
          {beltRank}
        </span>
        <div
          className={`${tipWidth} flex items-center justify-center gap-1 px-2`}
          style={{ backgroundColor: tipColor }}
        >
          {Array.from({ length: stripes }).map((_, i) => (
            <div
              key={i}
              className={`${stripeSizes[size]} rounded-sm`}
              style={{ backgroundColor: stripeColor }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
