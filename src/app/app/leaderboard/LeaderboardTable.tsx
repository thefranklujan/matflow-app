"use client";

const BELT_COLORS: Record<string, string> = {
  white: "bg-white",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  brown: "bg-amber-700",
  black: "bg-gray-900 ring-1 ring-white/30",
};

interface LeaderboardEntry {
  rank: number;
  memberId: string;
  name: string;
  beltRank: string;
  value: number;
  label: string;
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentMemberId: string | undefined;
}

const PODIUM_STYLES = [
  {
    medal: "🥇",
    bg: "from-yellow-500/20 to-yellow-600/5",
    border: "border-yellow-500/40",
    valueColor: "text-yellow-400",
    height: "h-32",
    order: "order-2",
    label: "1st Place",
  },
  {
    medal: "🥈",
    bg: "from-gray-300/15 to-gray-400/5",
    border: "border-gray-400/30",
    valueColor: "text-gray-300",
    height: "h-24",
    order: "order-1",
    label: "2nd Place",
  },
  {
    medal: "🥉",
    bg: "from-amber-600/15 to-amber-700/5",
    border: "border-amber-600/30",
    valueColor: "text-amber-500",
    height: "h-20",
    order: "order-3",
    label: "3rd Place",
  },
];

export default function LeaderboardTable({
  entries,
  currentMemberId,
}: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <div className="bg-brand-dark border border-brand-gray rounded-lg p-12 text-center">
        <p className="text-gray-500">No data for this period yet.</p>
      </div>
    );
  }

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="space-y-6">
      {/* Podium Cards */}
      {top3.length > 0 && (
        <div className="grid grid-cols-3 gap-3 items-end mb-2">
          {top3.map((entry, i) => {
            const style = PODIUM_STYLES[i];
            const isCurrentUser = entry.memberId === currentMemberId;
            return (
              <div
                key={entry.memberId}
                className={`${style.order} flex flex-col items-center`}
              >
                <div
                  className={`w-full bg-gradient-to-b ${style.bg} border ${style.border} rounded-xl p-4 flex flex-col items-center justify-center text-center ${style.height} ${
                    isCurrentUser ? "ring-2 ring-brand-accent" : ""
                  }`}
                >
                  <span className="text-3xl mb-1">{style.medal}</span>
                  <span
                    className={`w-4 h-4 rounded-full mb-1 ${
                      BELT_COLORS[entry.beltRank] || "bg-white"
                    }`}
                  />
                  <p className="text-white font-semibold text-sm truncate w-full">
                    {entry.name}
                  </p>
                  <p className={`font-bold text-lg ${style.valueColor}`}>
                    {entry.value}
                  </p>
                  <p className="text-gray-500 text-[10px] uppercase tracking-wider">
                    {entry.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Remaining entries */}
      {rest.length > 0 && (
        <div className="space-y-2">
          {rest.map((entry) => {
            const isCurrentUser = entry.memberId === currentMemberId;
            return (
              <div
                key={entry.memberId}
                className={`bg-brand-dark border rounded-lg p-4 flex items-center gap-4 ${
                  isCurrentUser
                    ? "bg-brand-accent/5 border-l-2 border-brand-accent"
                    : "border-brand-gray"
                }`}
              >
                <span className="text-lg font-bold w-8 text-center text-white">
                  {entry.rank}
                </span>

                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span
                    className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      BELT_COLORS[entry.beltRank] || "bg-white"
                    }`}
                  />
                  <span className="text-white font-medium truncate">
                    {entry.name}
                  </span>
                </div>

                <span className="text-brand-accent font-bold text-sm whitespace-nowrap">
                  {entry.value} {entry.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
