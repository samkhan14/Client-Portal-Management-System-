import type { ActivityType, Prisma, PrismaClient } from "@prisma/client";

export type Db = Prisma.TransactionClient | PrismaClient;

export async function recordActivity(
  db: Db,
  input: {
    organizationId: string;
    projectId?: string | null;
    actorId?: string | null;
    type: ActivityType;
    clientVisible: boolean;
    summary: string;
    entityType: string;
    entityId: string;
  },
) {
  await db.activityEvent.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.projectId ?? null,
      actorId: input.actorId ?? null,
      type: input.type,
      clientVisible: input.clientVisible,
      summary: input.summary.slice(0, 500),
      entityType: input.entityType,
      entityId: input.entityId,
    },
  });
}
