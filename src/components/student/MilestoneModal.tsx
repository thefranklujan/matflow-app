"use client";

import { Trophy } from "lucide-react";

interface Milestone {
  count: number;
  label: string;
}

export default function MilestoneModal({
  open,
  milestone,
  onClose,
}: {
  open: boolean;
  milestone: Milestone | null;
  onClose: () => void;
}) {
  if (!open || !milestone) return null;

  // 24 confetti particles, half red half white, varied delays/positions.
  const particles = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((i) => {
          const left = (i * 37) % 100;
          const delay = (i % 8) * 0.18;
          const duration = 2.4 + (i % 5) * 0.35;
          const isRed = i % 2 === 0;
          const size = 6 + (i % 4) * 2;
          return (
            <span
              key={i}
              className="mf-confetti"
              style={{
                left: `${left}%`,
                width: `${size}px`,
                height: `${size}px`,
                background: isRed ? "#dc2626" : "#ffffff",
                animationDelay: `${delay}s`,
                animationDuration: `${duration}s`,
              }}
            />
          );
        })}
      </div>

      <div
        className="relative z-10 w-full max-w-sm bg-[#0a0a0a] border border-[#dc2626]/40 rounded-2xl p-8 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-20 w-20 rounded-full bg-[#dc2626]/15 border border-[#dc2626]/40 flex items-center justify-center mb-5">
          <Trophy className="h-10 w-10 text-[#dc2626]" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#dc2626] font-bold mb-3">
          Milestone Unlocked
        </p>
        <p className="text-7xl font-black text-white leading-none mb-2 tracking-tight">
          {milestone.count}
        </p>
        <p className="text-xl font-bold text-white mb-6">{milestone.label}</p>
        <p className="text-sm text-gray-400 mb-7">
          Every rep counts. Stack the next one.
        </p>
        <button
          onClick={onClose}
          className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold px-5 py-3 rounded-lg transition"
        >
          Keep Training
        </button>
      </div>

      <style jsx>{`
        .mf-confetti {
          position: absolute;
          top: -20px;
          border-radius: 2px;
          opacity: 0;
          animation-name: mf-confetti-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes mf-confetti-fall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateY(105vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
