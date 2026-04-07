const BELT_COLORS: Record<string, string> = {
  white: "#FFFFFF",
  blue: "#1E40AF",
  purple: "#7C3AED",
  brown: "#92400E",
  black: "#1a1a1a",
};

const TIP_COLORS: Record<string, string> = {
  white: "#1a1a1a",
  blue: "#1a1a1a",
  purple: "#1a1a1a",
  brown: "#1a1a1a",
  black: "#B91C1C",
};

const STRIPE_COLORS: Record<string, string> = {
  white: "#1a1a1a",
  blue: "#FFFFFF",
  purple: "#FFFFFF",
  brown: "#FFFFFF",
  black: "#FFFFFF",
};

export default function MiniBelt({ beltRank, stripes }: { beltRank: string; stripes: number }) {
  const belt = BELT_COLORS[beltRank] || BELT_COLORS.white;
  const tip = TIP_COLORS[beltRank] || "#1a1a1a";
  const stripe = STRIPE_COLORS[beltRank] || "#FFFFFF";

  return (
    <span
      className="inline-flex items-stretch align-middle ml-1.5 h-4 w-12 rounded-sm overflow-hidden border border-white/20"
      style={{ backgroundColor: belt }}
    >
      <span className="flex-1" />
      <span
        className="flex items-center justify-center gap-[2px] px-1"
        style={{ backgroundColor: tip, minWidth: "20px" }}
      >
        {Array.from({ length: stripes }).map((_, i) => (
          <span
            key={i}
            className="inline-block w-[2px] h-2.5 rounded-sm"
            style={{ backgroundColor: stripe }}
          />
        ))}
      </span>
    </span>
  );
}
