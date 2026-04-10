import { prisma } from "@/lib/prisma";

interface LogActivityParams {
  gymId: string;
  action: string;
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetName?: string;
  meta?: Record<string, unknown>;
}

export function logActivity(params: LogActivityParams): void {
  prisma.activityLog.create({
    data: {
      gymId: params.gymId,
      action: params.action,
      actorId: params.actorId || null,
      actorName: params.actorName || null,
      targetId: params.targetId || null,
      targetName: params.targetName || null,
      meta: params.meta ? JSON.stringify(params.meta) : null,
    },
  }).catch((err) => console.error("[ActivityLog] Failed to write:", err));
}
