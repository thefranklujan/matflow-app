"use client";

const BELT_COLORS: Record<string, string> = {
  white: "#FFFFFF",
  blue: "#1E40AF",
  purple: "#7C3AED",
  brown: "#92400E",
  black: "#1a1a1a",
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

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div
        className={`${sizeClasses[size]} rounded-md flex items-center justify-between px-4 min-w-[140px] border border-white/20`}
        style={{ backgroundColor: beltColor }}
      >
        <span
          className={`font-semibold uppercase tracking-wider ${textColor}`}
        >
          {beltRank}
        </span>
        {stripes > 0 && (
          <div className="flex items-center gap-1 ml-3">
            {Array.from({ length: stripes }).map((_, i) => (
              <div
                key={i}
                className={`${stripeSizes[size]} rounded-sm bg-black`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
