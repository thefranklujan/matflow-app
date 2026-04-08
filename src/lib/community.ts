import { prisma } from "@/lib/prisma";

export interface CommentItem {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  authorAvatar: string | null;
  authorBelt: string;
  isMine: boolean;
}

export interface PostItem {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  authorBelt: string;
  authorJoinedAt: string;
  authorSessionCount: number;
  isMine: boolean;
  reportCount: number;
  hidden: boolean;
  likeCount: number;
  likedByMe: boolean;
  comments: CommentItem[];
}

export interface MemberItem {
  studentId: string;
  name: string;
  avatarUrl: string | null;
  joinedAt: string;
  role: string;
  belt: string;
  sessionCount: number;
}

export interface LeaderboardEntry {
  studentId: string;
  name: string;
  avatarUrl: string | null;
  belt: string;
  sessions: number;
}

export interface GroupSummary {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  memberCount: number;
  myRole: string;
  myStatus: string;
  pendingCount: number;
}

export interface CommunityData {
  groups: GroupSummary[];
  selectedGroupId: string | null;
  posts: PostItem[];
  members: MemberItem[];
  pending: MemberItem[];
  leaderboard: LeaderboardEntry[];
  isMod: boolean;
  myStatus: string;
}

async function decorateMembers(
  memberRows: Array<{
    studentId: string;
    joinedAt: Date;
    role: string;
    student: { firstName: string; lastName: string; avatarUrl: string | null; beltRank: string } | null;
  }>
): Promise<MemberItem[]> {
  const ids = memberRows.map((m) => m.studentId);
  const sessionCounts = ids.length
    ? await prisma.trainingSession.groupBy({
        by: ["studentId"],
        where: { studentId: { in: ids } },
        _count: { studentId: true },
      })
    : [];
  const countMap = new Map(sessionCounts.map((s) => [s.studentId, s._count.studentId]));
  return memberRows.map((m) => ({
    studentId: m.studentId,
    name: m.student ? `${m.student.firstName} ${m.student.lastName}` : "Unknown",
    avatarUrl: m.student?.avatarUrl ?? null,
    joinedAt: m.joinedAt.toISOString(),
    role: m.role,
    belt: m.student?.beltRank || "white",
    sessionCount: countMap.get(m.studentId) || 0,
  }));
}

export async function fetchCommunityData(studentId: string, selectedGroupId?: string | null): Promise<CommunityData> {
  // All groups this student belongs to (active or pending)
  const myMemberships = await prisma.gymGroupMember.findMany({
    where: { studentId },
    include: { group: true },
    orderBy: { joinedAt: "desc" },
  });

  const groupSummaries: GroupSummary[] = await Promise.all(
    myMemberships.map(async (m) => {
      const pendingCount = m.role === "mod"
        ? await prisma.gymGroupMember.count({ where: { groupId: m.groupId, status: "pending" } })
        : 0;
      return {
        id: m.group.id,
        name: m.group.name,
        city: m.group.city,
        state: m.group.state,
        memberCount: m.group.memberCount,
        myRole: m.role,
        myStatus: m.status,
        pendingCount,
      };
    })
  );

  const activeId = selectedGroupId && groupSummaries.some((g) => g.id === selectedGroupId)
    ? selectedGroupId
    : groupSummaries[0]?.id ?? null;

  let posts: PostItem[] = [];
  let members: MemberItem[] = [];
  let pending: MemberItem[] = [];
  let leaderboard: LeaderboardEntry[] = [];
  let isMod = false;
  let myStatus = "active";

  if (activeId) {
    const myMembership = myMemberships.find((m) => m.groupId === activeId);
    isMod = myMembership?.role === "mod";
    myStatus = myMembership?.status || "active";

    if (myStatus === "active") {
      const [rawPosts, rawActiveMembers, rawPending] = await Promise.all([
        prisma.groupPost.findMany({
          where: { groupId: activeId },
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            student: { select: { firstName: true, lastName: true, createdAt: true, avatarUrl: true, beltRank: true } },
            likes: { select: { studentId: true } },
            comments: {
              orderBy: { createdAt: "asc" },
              take: 20,
              include: { student: { select: { firstName: true, lastName: true, avatarUrl: true, beltRank: true } } },
            },
          },
        }),
        prisma.gymGroupMember.findMany({
          where: { groupId: activeId, status: "active" },
          include: { student: { select: { firstName: true, lastName: true, avatarUrl: true, beltRank: true } } },
          orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
        }),
        isMod
          ? prisma.gymGroupMember.findMany({
              where: { groupId: activeId, status: "pending" },
              include: { student: { select: { firstName: true, lastName: true, avatarUrl: true, beltRank: true } } },
              orderBy: { joinedAt: "asc" },
            })
          : Promise.resolve([]),
      ]);

      const authorIds = Array.from(new Set(rawPosts.map((p) => p.studentId)));
      const sessionCounts = authorIds.length
        ? await prisma.trainingSession.groupBy({
            by: ["studentId"],
            where: { studentId: { in: authorIds } },
            _count: { studentId: true },
          })
        : [];
      const sessionMap = new Map(sessionCounts.map((s) => [s.studentId, s._count.studentId]));

      posts = rawPosts.map((p) => ({
        id: p.id,
        body: p.body,
        createdAt: p.createdAt.toISOString(),
        authorId: p.studentId,
        authorName: p.student ? `${p.student.firstName} ${p.student.lastName}` : "Unknown",
        authorAvatar: p.student?.avatarUrl ?? null,
        authorBelt: p.student?.beltRank || "white",
        authorJoinedAt: p.student?.createdAt.toISOString() || "",
        authorSessionCount: sessionMap.get(p.studentId) || 0,
        isMine: p.studentId === studentId,
        reportCount: p.reportCount,
        hidden: p.hidden,
        likeCount: p.likes.length,
        likedByMe: p.likes.some((l) => l.studentId === studentId),
        comments: p.comments.map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
          authorName: c.student ? `${c.student.firstName} ${c.student.lastName}` : "Unknown",
          authorAvatar: c.student?.avatarUrl ?? null,
          authorBelt: c.student?.beltRank || "white",
          isMine: c.studentId === studentId,
        })),
      }));

      members = await decorateMembers(rawActiveMembers);
      pending = await decorateMembers(rawPending);

      // Leaderboard: top 5 students in this group by training sessions logged this month
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const memberStudentIds = members.map((m) => m.studentId);
      if (memberStudentIds.length) {
        const monthCounts = await prisma.trainingSession.groupBy({
          by: ["studentId"],
          where: { studentId: { in: memberStudentIds }, date: { gte: monthStart } },
          _count: { studentId: true },
          orderBy: { _count: { studentId: "desc" } },
          take: 5,
        });
        const memberMap = new Map(members.map((m) => [m.studentId, m]));
        leaderboard = monthCounts.map((c) => {
          const m = memberMap.get(c.studentId);
          return {
            studentId: c.studentId,
            name: m?.name || "Unknown",
            avatarUrl: m?.avatarUrl ?? null,
            belt: m?.belt || "white",
            sessions: c._count.studentId,
          };
        });
      }
    }
  }

  return {
    groups: groupSummaries,
    selectedGroupId: activeId,
    posts,
    members,
    pending,
    leaderboard,
    isMod,
    myStatus,
  };
}
