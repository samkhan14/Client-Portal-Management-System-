import { prisma } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { canComment, isClientRole, projectVisibilityWhere } from "@/lib/authz";
import type { Actor } from "@/lib/auth/types";
import { recordActivity } from "@/server/activity";
import { notifyRecipients, processEmailNotifications } from "@/server/notifications";
import { requireProject } from "@/server/projects";

export async function listComments(actor: Actor, projectId: string, taskId?: string | null) {
  await requireProject(actor, projectId);
  const comments = await prisma.comment.findMany({
    where: {
      projectId,
      project: projectVisibilityWhere(actor),
      ...(taskId ? { taskId } : { taskId: null, deliverableId: null }),
      ...(isClientRole(actor.role) ? { clientVisible: true } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true } },
      files: { where: { deletedAt: null }, select: { id: true, originalName: true, clientVisible: true } },
    },
  });
  return comments.map((comment) => ({
    id: comment.id,
    body: comment.body,
    clientVisible: comment.clientVisible,
    createdAt: comment.createdAt,
    authorName: isClientRole(actor.role) && comment.author.id !== actor.userId ? "Project team" : comment.author.name,
    files: comment.files.filter((file) => !isClientRole(actor.role) || file.clientVisible),
  }));
}

export async function addComment(
  actor: Actor,
  input: { projectId: string; body: string; clientVisible?: boolean; taskId?: string | null; deliverableId?: string | null },
) {
  if (!canComment(actor.role)) throw forbidden("You cannot comment on this project.");
  const project = await requireProject(actor, input.projectId);
  const body = input.body.trim();
  if (body.length < 1 || body.length > 5000) throw new AppError("VALIDATION", "Enter a comment.");
  const clientVisible = isClientRole(actor.role) ? true : Boolean(input.clientVisible);
  const taskId = input.taskId || null;
  const deliverableId = input.deliverableId || null;
  if (taskId) {
    const task = await prisma.task.findFirst({ where: { id: taskId, projectId: project.id } });
    if (!task || (isClientRole(actor.role) && !task.clientVisible)) throw notFound();
    if (clientVisible && !task.clientVisible) {
      throw new AppError("VISIBILITY", "A comment cannot be client-visible on a staff-only task.");
    }
  }
  if (deliverableId) {
    const deliverable = await prisma.deliverable.findFirst({ where: { id: deliverableId, projectId: project.id } });
    if (!deliverable) throw notFound();
  }
  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        projectId: project.id,
        taskId,
        deliverableId,
        authorId: actor.userId,
        body,
        clientVisible,
      },
    });
    await recordActivity(tx, {
      organizationId: actor.organizationId,
      projectId: project.id,
      actorId: actor.userId,
      type: "COMMENT_ADDED",
      clientVisible,
      summary: clientVisible ? "A comment was added." : "An internal note was added.",
      entityType: "comment",
      entityId: created.id,
    });
    await notifyRecipients(tx, {
      organizationId: actor.organizationId,
      projectId: project.id,
      actorId: actor.userId,
      type: clientVisible ? "comment.client" : "comment.internal",
      title: clientVisible ? `New comment on ${project.name}` : `Internal note on ${project.name}`,
      body: clientVisible ? "A client-visible comment was added." : "An internal note was added.",
      dedupeKey: `comment:${created.id}`,
      clientSafe: clientVisible,
      suffix: taskId ? "/tasks" : "",
    });
    return created;
  });
  await processEmailNotifications();
  return comment;
}

export async function listActivity(actor: Actor, projectId: string) {
  await requireProject(actor, projectId);
  return prisma.activityEvent.findMany({
    where: {
      projectId,
      organizationId: actor.organizationId,
      ...(isClientRole(actor.role) ? { clientVisible: true } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { name: true } } },
  }).then((events) =>
    events.map((event) => ({
      id: event.id,
      type: event.type,
      summary: event.summary,
      clientVisible: event.clientVisible,
      createdAt: event.createdAt,
      actorName: isClientRole(actor.role) ? null : event.actor?.name ?? null,
    })),
  );
}
