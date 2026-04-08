// Server-friendly read: caller passes the data in. Shown on the student home.
// Lists friends (same gym / group / homeGym) who have a training plan for today.

interface FriendToday {
  name: string;
  avatarUrl?: string | null;
  block: string;
  gym: string | null;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function WhosTrainingToday({ friends }: { friends: FriendToday[] }) {
  if (friends.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="bg-gradient-to-br from-[#dc2626]/10 via-[#dc2626]/5 to-transparent border border-[#dc2626]/25 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-bold text-base">
              {friends.length} {friends.length === 1 ? "friend is" : "friends are"} training today
            </h2>
            <p className="text-gray-400 text-xs mt-0.5">You are not alone on the mats.</p>
          </div>
          <div className="flex -space-x-2">
            {friends.slice(0, 5).map((f, i) => (
              <div key={i} className="h-8 w-8 rounded-full border-2 border-[#0a0a0a] overflow-hidden bg-[#dc2626] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                {f.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.avatarUrl} alt={f.name} className="h-full w-full object-cover" />
                ) : (
                  <span>{initials(f.name)}</span>
                )}
              </div>
            ))}
            {friends.length > 5 && (
              <div className="h-8 w-8 rounded-full border-2 border-[#0a0a0a] bg-white/10 text-white text-[10px] font-bold flex items-center justify-center">
                +{friends.length - 5}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          {friends.slice(0, 4).map((f, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="text-white font-medium">{f.name}</span>
              <span className="text-gray-500 text-xs">
                {f.block}{f.gym ? ` · ${f.gym}` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
