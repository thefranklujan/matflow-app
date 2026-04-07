import { prisma } from "@/lib/prisma";

export async function fetchCommunityData(studentId: string, selectedGroupId?: string | null) {
  const memberships = await prisma.gymGroupMember.findMany({
    where: { studentId },
    include: { group: true },
    orderBy: { joinedAt: "desc" },
  });

  const groups = memberships.map((m) => ({
    id: m.group.id,
    name: m.group.name,
    city: m.group.city,
    state: m.group.state,
    memberCount: m.group.memberCount,
  }));

  const activeId = selectedGroupId && groups.some((g) => g.id === selectedGroupId)
    ? selectedGroupId
    : groups[0]?.id ?? null;

  let posts: Array<{
    id: string;
    body: string;
    createdAt: string;
    authorName: string;
    authorBelt: string;
    isMine: boolean;
  }> = [];
  let members: Array<{ studentId: string; name: string; joinedAt: string }> = [];

  if (activeId) {
    const [rawPosts, rawMembers] = await Promise.all([
      prisma.groupPost.findMany({
        where: { groupId: activeId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { student: { select: { firstName: true, lastName: true } } },
      }),
      prisma.gymGroupMember.findMany({
        where: { groupId: activeId },
        include: { student: { select: { firstName: true, lastName: true } } },
        orderBy: { joinedAt: "asc" },
      }),
    ]);

    posts = rawPosts.map((p) => ({
      id: p.id,
      body: p.body,
      createdAt: p.createdAt.toISOString(),
      authorName: p.student ? `${p.student.firstName} ${p.student.lastName}` : "Unknown",
      authorBelt: "white",
      isMine: p.studentId === studentId,
    }));

    members = rawMembers.map((m) => ({
      studentId: m.studentId,
      name: m.student ? `${m.student.firstName} ${m.student.lastName}` : "Unknown",
      joinedAt: m.joinedAt.toISOString(),
    }));
  }

  return { groups, selectedGroupId: activeId, posts, members };
}
