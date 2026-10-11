import type { OrgRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isClientRole } from "@/lib/authz";
import { addUtcDays, safeInternalPath, utcToday } from "@/lib/format";
import type { Db } from "@/server/activity";

type Recipient = { userId: string; role: OrgRole };

export async function queueNotification(
  db: Db,
  input: {
    organizationId: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    linkPath?: string | null;
    dedupeKey: string;
    clientSafe: boolean;
    recipientRole: OrgRole;
  },
) {
  if (!input.clientSafe && isClientRole(input.recipientRole)) return;
  const org = await db.organization.findUnique({
    where: { id: input.organizationId },
    select: { emailNotificationsEnabled: true },
  });
  const linkPath = safeInternalPath(input.linkPath);
  const base = {
    organizationId: input.organizationId,
    userId: input.userId,
    type: input.type.slice(0, 80),
    title: input.title.slice(0, 180),
    body: input.body.slice(0, 500),
    linkPath,
  };
  await insertIgnore(db, {
    ...base,
    channel: "IN_APP",
    status: "SENT",
    dedupeKey: `inapp:${input.dedupeKey}`,
  });
  await insertIgnore(db, {
    ...base,
    channel: "EMAIL",
    status: org?.emailNotificationsEnabled ? "PENDING" : "SKIPPED",
    dedupeKey: `email:${input.dedupeKey}`,
  });
}

async function insertIgnore(db: Db, data: Prisma.NotificationCreateManyInput) {
  await db.notification.createMany({ data: [data], skipDuplicates: true });
}

export async function processEmailNotifications(limit = 50): Promise<number> {
  const pending = await prisma.notification.findMany({
    where: { channel: "EMAIL", status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let sent = 0;
  for (const notification of pending) {
    const claimed = await prisma.notification.updateMany({
      where: { id: notification.id, status: "PENDING" },
      data: { status: "SENT", sentAt: new Date() },
    });
    if (claimed.count !== 1) continue;
    console.info(
      `[email-noop] user=${notification.userId} type=${notification.type} title=${JSON.stringify(notification.title)}`,
    );
    sent += 1;
  }
  return sent;
}

export async function projectRecipients(projectId: string): Promise<Recipient[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true, clientCompanyId: true },
  });
  if (!project) return [];
  const [members, admins] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    }),
    prisma.membership.findMany({
      where: {
        organizationId: project.organizationId,
        clientCompanyId: project.clientCompanyId,
        role: "CLIENT_ADMIN",
        revokedAt: null,
      },
      select: { userId: true, role: true },
    }),
  ]);
  const userIds = [...new Set([...members.map((member) => member.userId), ...admins.map((admin) => admin.userId)])];
  const memberships = await prisma.membership.findMany({
    where: { organizationId: project.organizationId, userId: { in: userIds }, revokedAt: null },
    select: { userId: true, role: true },
  });
  return memberships.map((membership) => ({ userId: membership.userId, role: membership.role }));
}

export function linkForRole(role: OrgRole, projectId: string, suffix = ""): string {
  const base = isClientRole(role) ? `/portal/projects/${projectId}` : `/projects/${projectId}`;
  return `${base}${suffix}`;
}

export async function notifyRecipients(
  db: Db,
  input: {
    organizationId: string;
    projectId: string;
    actorId?: string | null;
    type: string;
    title: string;
    body: string;
    dedupeKey: string;
    clientSafe: boolean;
    recipients?: Recipient[];
    suffix?: string;
  },
) {
  const recipients = input.recipients ?? (await projectRecipients(input.projectId));
  for (const recipient of recipients) {
    if (recipient.userId === input.actorId) continue;
    await queueNotification(db, {
      organizationId: input.organizationId,
      userId: recipient.userId,
      recipientRole: recipient.role,
      type: input.type,
      title: input.title,
      body: input.body,
      clientSafe: input.clientSafe,
      dedupeKey: `${input.dedupeKey}:${recipient.userId}`,
      linkPath: linkForRole(recipient.role, input.projectId, input.suffix ?? ""),
    });
  }
}

export async function scanApproachingDeadlines(organizationId: string) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) return { scanned: 0, created: 0 };
  const start = utcToday();
  const end = addUtcDays(start, org.deadlineReminderDays);
  const tasks = await prisma.task.findMany({
    where: {
      assigneeId: { not: null },
      status: { not: "DONE" },
      dueDate: { gte: start, lte: end },
      project: { organizationId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    },
    include: {
      assignee: { select: { id: true } },
      project: { select: { id: true, name: true, organizationId: true } },
    },
  });
  let created = 0;
  for (const task of tasks) {
    if (!task.assigneeId || !task.dueDate) continue;
    const membership = await prisma.membership.findFirst({
      where: { userId: task.assigneeId, organizationId, revokedAt: null },
    });
    if (!membership) continue;
    if (isClientRole(membership.role) && !task.clientVisible) continue;
    const day = task.dueDate.toISOString().slice(0, 10);
    const dedupeKey = `deadline:${task.id}:${task.assigneeId}:${day}`;
    const existing = await prisma.notification.findUnique({
      where: { dedupeKey: `inapp:${dedupeKey}:${task.assigneeId}` },
    });
    await queueNotification(prisma, {
      organizationId,
      userId: task.assigneeId,
      recipientRole: membership.role,
      type: "deadline.approaching",
      title: `Due soon: ${task.title}`,
      body: `${task.title} on ${task.project.name} is due ${day}.`,
      clientSafe: task.clientVisible || !isClientRole(membership.role),
      dedupeKey: `${dedupeKey}:${task.assigneeId}`,
      linkPath: linkForRole(membership.role, task.projectId, "/tasks"),
    });
    if (!existing) created += 1;
  }
  await processEmailNotifications();
  return { scanned: tasks.length, created };
}

export async function listNotifications(actorUserId: string, organizationId: string) {
  return prisma.notification.findMany({
    where: { userId: actorUserId, organizationId, channel: "IN_APP" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function unreadCount(actorUserId: string, organizationId: string) {
  return prisma.notification.count({
    where: { userId: actorUserId, organizationId, channel: "IN_APP", readAt: null },
  });
}

export async function markNotificationRead(actorUserId: string, organizationId: string, id: string) {
  await prisma.notification.updateMany({
    where: { id, userId: actorUserId, organizationId, channel: "IN_APP" },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(actorUserId: string, organizationId: string) {
  await prisma.notification.updateMany({
    where: { userId: actorUserId, organizationId, channel: "IN_APP", readAt: null },
    data: { readAt: new Date() },
  });
}
