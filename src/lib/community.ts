import { prisma } from "@/lib/prisma";

export interface PostItem {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorBelt: string;
  authorJoinedAt: string;
  authorSessionCount: number;
  isMine: boolean;
  reportCount: number;
  hidden: boolean;
}

export interface MemberItem {
  studentId: string;
  name: string;
  joinedAt: string;
  role: string;
  belt: string;
  sessionCount: number;
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
  isMod: boolean;
  myStatus: string;
}

async function decorateMembers(memberRows: Array<{ studentId: string; joinedAt: Date; role: string; student: { firstName: string; lastName: string } | null }>): Promise<MemberItem[]> {
  const ids = memberRows.map((m) => m.studentId);
  const sessionCounts = ids.length
    ? await prisma.trainingSession.groupBy({
        by: ["studentId"],
        where: { studentId: { in: ids } },
        _count: { studentId: true },
      })
    : [];
  const countMap = new Map(sessionCounts.map((s) => [s.studentId, s._count.studentId]));
  const beltMap = new Map<string, string>();
  if (ids.length) {
    const beltMembers = await prisma.member.findMany({
      where: { studentId: { in: ids } },
      select: { studentId: true, beltRank: true },
    });
    for (const b of beltMembers) {
      if (b.studentId) beltMap.set(b.studentId, b.beltRank);
    }
  }
  return memberRows.map((m) => ({
    studentId: m.studentId,
    name: m.student ? `${m.student.firstName} ${m.student.lastName}` : "Unknown",
    joinedAt: m.joinedAt.toISOString(),
    role: m.role,
    belt: beltMap.get(m.studentId) || "white",
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
          include: { student: { select: { firstName: true, lastName: true, createdAt: true } } },
        }),
        prisma.gymGroupMember.findMany({
          where: { groupId: activeId, status: "active" },
          include: { student: { select: { firstName: true, lastName: true } } },
          orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
        }),
        isMod
          ? prisma.gymGroupMember.findMany({
              where: { groupId: activeId, status: "pending" },
              include: { student: { select: { firstName: true, lastName: true } } },
              orderBy: { joinedAt: "asc" },
            })
          : Promise.resolve([]),
      ]);

      // decorate posts with author identity
      const authorIds = Array.from(new Set(rawPosts.map((p) => p.studentId)));
      const sessionCounts = authorIds.length
        ? await prisma.trainingSession.groupBy({
            by: ["studentId"],
            where: { studentId: { in: authorIds } },
            _count: { studentId: true },
          })
        : [];
      const sessionMap = new Map(sessionCounts.map((s) => [s.studentId, s._count.studentId]));
      const beltMembers = authorIds.length
        ? await prisma.member.findMany({
            where: { studentId: { in: authorIds } },
            select: { studentId: true, beltRank: true },
          })
        : [];
      const beltMap = new Map<string, string>();
      for (const b of beltMembers) {
        if (b.studentId) beltMap.set(b.studentId, b.beltRank);
      }

      posts = rawPosts.map((p) => ({
        id: p.id,
        body: p.body,
        createdAt: p.createdAt.toISOString(),
        authorId: p.studentId,
        authorName: p.student ? `${p.student.firstName} ${p.student.lastName}` : "Unknown",
        authorBelt: beltMap.get(p.studentId) || "white",
        authorJoinedAt: p.student?.createdAt.toISOString() || "",
        authorSessionCount: sessionMap.get(p.studentId) || 0,
        isMine: p.studentId === studentId,
        reportCount: p.reportCount,
        hidden: p.hidden,
      }));

      members = await decorateMembers(rawActiveMembers);
      pending = await decorateMembers(rawPending);
    }
  }

  return {
    groups: groupSummaries,
    selectedGroupId: activeId,
    posts,
    members,
    pending,
    isMod,
    myStatus,
  };
}
