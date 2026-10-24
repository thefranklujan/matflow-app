export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CalendarDays, Megaphone, Award, FileSignature, Video, Search } from "lucide-react";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";
import { studentMemberships } from "@/lib/student-membership";
import { upcomingOccurrences } from "@/lib/class-window";
import { commitmentDateKey, resolveCommitment } from "@/lib/class-commitment";
import WaiverPanel from "@/components/waiver/WaiverPanel";
import AcademyClassList, { type AcademyClassItem } from "@/components/student/AcademyClassList";

function beltLabel(belt: string, stripes: number) {
  const b = belt.charAt(0).toUpperCase() + belt.slice(1);
  return stripes > 0 ? `${b} belt, ${stripes} stripe${stripes === 1 ? "" : "s"}` : `${b} belt`;
}

function dayLabel(classDate: Date) {
  return classDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * Student Academy view: one academy the student is an ACTIVE, approved member
 * of. Access is derived server-side from the session's studentId plus a
 * current membership; `?gym=` only selects among those memberships, so a
 * non-member, revoked member, or other tenant sees no private content.
 */
export default async function StudentAcademyPage({
  searchParams,
}: {
  searchParams: Promise<{ gym?: string }>;
}) {
  const session = await getSession();
  if (!session?.studentId) redirect("/sign-in");
  const { gym: requestedGym } = await searchParams;

  const memberships = await studentMemberships(session.studentId);

  if (memberships.length === 0) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-white mb-2">My Academy</h1>
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-8 text-center mt-6">
          <Building2 className="h-10 w-10 text-gray-400 mx-auto mb-3" aria-hidden />
          <p className="text-white font-semibold mb-1">You are not an active member of an academy yet</p>
          <p className="text-gray-400 text-sm mb-5">
            MatFlow is free for students. Find your academy and request to join; your training log works either way.
          </p>
          <Link
            href="/student/gyms"
            className="inline-flex items-center gap-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold px-5 py-3 rounded-lg"
          >
            <Search className="h-4 w-4" aria-hidden /> Find your academy
          </Link>
        </div>
      </div>
    );
  }

  const requestedIsMine = requestedGym ? memberships.some((m) => m.gymId === requestedGym) : true;
  if (!requestedIsMine) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-white mb-2">My Academy</h1>
        <p role="alert" className="text-amber-300 text-sm mt-4">
          You are not an active member of that academy, so its classes and resources are not available.
        </p>
        <Link href="/student/academy" className="text-[#ef4444] underline text-sm mt-3 inline-block">
          Open one of your academies
        </Link>
      </div>
    );
  }

  const selected =
    memberships.find((m) => m.gymId === requestedGym) ??
    memberships.find((m) => m.gymId === session.gymId) ??
    memberships[0];
  const gym = selected.gym;
  const tz = gym.timezone || "America/Chicago";
  const now = new Date();

  const [student, slots, announcements, history, videos] = await Promise.all([
    prisma.student.findUnique({ where: { id: session.studentId }, select: { beltRank: true, stripes: true } }),
    prisma.classSchedule.findMany({ where: { gymId: gym.id, active: true }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] }),
    prisma.announcement.findMany({
      where: { gymId: gym.id },
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
      take: 4,
    }),
    prisma.beltProgress.findMany({
      where: { memberId: selected.id, gymId: gym.id },
      orderBy: { awardedAt: "desc" },
      take: 10,
    }),
    prisma.video.findMany({
      where: { gymId: gym.id, published: true },
      orderBy: { classDate: "desc" },
      take: 6,
    }),
  ]);

  const upcoming = upcomingOccurrences(slots, now, tz, 7).slice(0, 8);
  const commitments = upcoming.length
    ? await prisma.scheduleCommitment.findMany({
        where: {
          gymId: gym.id,
          memberId: selected.id,
          classDate: {
            gte: new Date(upcoming[0].classDate.getTime() - 14 * 3600_000),
            lt: new Date(upcoming[upcoming.length - 1].classDate.getTime() + 38 * 3600_000),
          },
        },
      })
    : [];
  const committedKeys = new Set<string>();
  for (const c of commitments) {
    const r = resolveCommitment(c, slots, tz);
    if (r.status === "resolved") committedKeys.add(`${r.scheduleId}:${commitmentDateKey(c.classDate, tz)}`);
  }
  const classItems: AcademyClassItem[] = upcoming.map((o) => ({
    scheduleId: o.scheduleId,
    dateKey: o.dateKey,
    dayLabel: dayLabel(o.classDate),
    startTime: o.startTime,
    endTime: o.endTime,
    classType: o.classType,
    instructor: o.instructor,
    committed: committedKeys.has(`${o.scheduleId}:${o.dateKey}`),
  }));

  const card = "bg-[#0a0a0a] border border-white/10 rounded-xl p-5";
  const heading = "flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider mb-3";

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <p className="text-gray-400 text-xs uppercase tracking-wider">My Academy</p>
        <h1 className="text-3xl font-bold text-white break-words">{gym.name}</h1>
        <p className="text-gray-400 text-sm mt-1">
          {[gym.city, gym.state].filter(Boolean).join(", ")}
          {gym.city || gym.state ? " · " : ""}Active member
        </p>
      </div>

      {memberships.length > 1 && (
        <nav aria-label="Choose academy" className="mb-6 flex flex-wrap gap-2">
          {memberships.map((m) => (
            <Link
              key={m.id}
              href={`/student/academy?gym=${encodeURIComponent(m.gymId)}`}
              aria-current={m.gymId === gym.id ? "page" : undefined}
              className={`text-sm px-3 py-2 rounded-lg border ${
                m.gymId === gym.id ? "border-[#dc2626] text-white bg-[#dc2626]/10" : "border-white/10 text-gray-300 hover:border-white/30"
              }`}
            >
              {m.gym.name}
            </Link>
          ))}
        </nav>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className={card} aria-labelledby="academy-classes">
          <h2 id="academy-classes" className={heading}>
            <CalendarDays className="h-4 w-4 text-[#ef4444]" aria-hidden /> Next classes
          </h2>
          <AcademyClassList gymId={gym.id} items={classItems} />
        </section>

        <section id="waiver" className={card} aria-labelledby="academy-waiver">
          <h2 id="academy-waiver" className={heading}>
            <FileSignature className="h-4 w-4 text-[#ef4444]" aria-hidden /> Waiver
          </h2>
          <WaiverPanel endpoint={`/api/student/academy/${encodeURIComponent(gym.id)}/waiver`} compact />
        </section>

        <section id="progress" className={card} aria-labelledby="academy-progress">
          <h2 id="academy-progress" className={heading}>
            <Award className="h-4 w-4 text-[#ef4444]" aria-hidden /> My progress at {gym.name}
          </h2>
          <p className="text-gray-400 text-xs">Verified rank recorded by {gym.name}</p>
          <p className="text-white text-xl font-bold mt-1">{beltLabel(selected.beltRank, selected.stripes)}</p>
          {history.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between gap-3 text-sm">
                  <span className="text-gray-300">{beltLabel(h.beltRank, h.stripes)}</span>
                  <span className="text-gray-400">{h.awardedAt.toLocaleDateString("en-US", { timeZone: tz })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm mt-3">No promotions recorded at this academy yet.</p>
          )}
          {student && (
            <p className="text-gray-400 text-xs mt-4 border-t border-white/5 pt-3">
              Your personal rank (self-reported on your profile): {beltLabel(student.beltRank, student.stripes)}. Each
              academy&apos;s verified rank is kept separately.
            </p>
          )}
        </section>

        <section className={card} aria-labelledby="academy-news">
          <h2 id="academy-news" className={heading}>
            <Megaphone className="h-4 w-4 text-[#ef4444]" aria-hidden /> Announcements
          </h2>
          {announcements.length === 0 ? (
            <p className="text-gray-400 text-sm">No announcements yet.</p>
          ) : (
            <ul className="space-y-3">
              {announcements.map((a) => (
                <li key={a.id}>
                  <p className="text-white text-sm font-medium">{a.title}</p>
                  <p className="text-gray-400 text-xs line-clamp-2 whitespace-pre-line">{a.content}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${card} lg:col-span-2`} aria-labelledby="academy-videos">
          <h2 id="academy-videos" className={heading}>
            <Video className="h-4 w-4 text-[#ef4444]" aria-hidden /> Lessons and videos
          </h2>
          {videos.length === 0 ? (
            <p className="text-gray-400 text-sm">Your academy has not published any videos yet.</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {videos.map((v) => (
                <li key={v.id}>
                  <a
                    href={v.embedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border border-white/10 rounded-lg p-3 hover:border-[#dc2626]"
                  >
                    <p className="text-white text-sm font-medium truncate">{v.title}</p>
                    <p className="text-gray-400 text-xs">
                      {v.classType} · {v.classDate.toLocaleDateString("en-US", { timeZone: "UTC" })}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
