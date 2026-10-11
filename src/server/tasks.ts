import { Prisma, type Priority, type TaskStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { parseUtcDate } from "@/lib/format";
import { canManageAllProjects, isClientRole, projectVisibilityWhere } from "@/lib/authz";
import type { Actor } from "@/lib/auth/types";
import { prioritySchema, taskStatusSchema } from "@/lib/validators";
import { TASK_STATUS_LABEL } from "@/lib/constants";
import { recordActivity } from "@/server/activity";
import { processEmailNotifications, projectRecipients, queueNotification, linkForRole } from "@/server/notifications";
import { requireProject } from "@/server/projects";

const createSchema = z.object({
  title: z.string().trim().min(2, "Enter a task title.").max(200),
  description: z.string().trim().max(8000).optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  milestoneId: z.string().optional().nullable(),
  parentTaskId: z.string().optional().nullable(),
  blockedByTaskId: z.string().optional().nullable(),
  priority: prioritySchema.optional(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  estimateHours: z.string().optional().nullable(),
  clientVisible: z.boolean().optional(),
  status: taskStatusSchema.optional(),
});

export async function listTasks(
  actor: Actor,
  projectId: string,
  filters: {
    q?: string;
    status?: string;
    priority?: string;
    assigneeId?: string;
    clientVisible?: string;
    page: number;
    pageSize: number;
  },
) {
  await requireProject(actor, projectId);
  const q = filters.q?.trim();
  const client = isClientRole(actor.role);
  const where: Prisma.TaskWhereInput = {
    projectId,
    project: projectVisibilityWhere(actor),
    ...(client ? { clientVisible: true } : {}),
    ...(filters.status ? { status: taskStatusSchema.parse(filters.status) } : {}),
    ...(filters.priority ? { priority: prioritySchema.parse(filters.priority) } : {}),
    ...(!client && filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    ...(!client && filters.clientVisible === "true" ? { clientVisible: true } : {}),
    ...(!client && filters.clientVisible === "false" ? { clientVisible: false } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { title: "asc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      include: {
        assignee: { select: { id: true, name: true } },
        milestone: { select: { id: true, title: true } },
        parent: { select: { id: true, title: true } },
        _count: { select: { subtasks: true } },
      },
    }),
  ]);
  return {
    total,
    items: items.map((task) => presentTask(task, actor)),
  };
}

export async function boardTasks(
  actor: Actor,
  projectId: string,
  filters: { q?: string; priority?: string; assigneeId?: string; clientVisible?: string },
) {
  await requireProject(actor, projectId);
  const client = isClientRole(actor.role);
  const q = filters.q?.trim();
  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      project: projectVisibilityWhere(actor),
      ...(client ? { clientVisible: true } : {}),
      ...(filters.priority ? { priority: prioritySchema.parse(filters.priority) } : {}),
      ...(!client && filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(!client && filters.clientVisible === "true" ? { clientVisible: true } : {}),
      ...(!client && filters.clientVisible === "false" ? { clientVisible: false } : {}),
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    take: 300,
    include: {
      assignee: { select: { id: true, name: true } },
      parent: { select: { id: true, title: true } },
    },
  });
  return tasks.map((task) => presentTask(task, actor));
}

export async function createTask(actor: Actor, projectId: string, input: unknown) {
  if (!canManageAllProjects(actor.role)) throw forbidden();
  const project = await requireProject(actor, projectId);
  const data = createSchema.parse(input);
  const milestoneId = empty(data.milestoneId);
  const parentTaskId = empty(data.parentTaskId);
  const assigneeId = empty(data.assigneeId);
  const blockedByTaskId = empty(data.blockedByTaskId);
  if (milestoneId) await assertMilestone(project.id, milestoneId);
  if (parentTaskId) await assertParent(project.id, parentTaskId);
  let clientVisible = Boolean(data.clientVisible);
  if (assigneeId) {
    const assigneeIsClient = await assertAssignee(project.id, assigneeId);
    if (assigneeIsClient) clientVisible = true;
  }
  const estimateHours = parseEstimate(data.estimateHours);
  const status = data.status ?? "TODO";
  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        projectId: project.id,
        milestoneId,
        parentTaskId,
        title: data.title,
        description: empty(data.description),
        assigneeId,
        creatorId: actor.userId,
        status,
        priority: data.priority ?? "MEDIUM",
        startDate: parseDate(data.startDate),
        dueDate: parseDate(data.dueDate),
        estimateHours,
        clientVisible,
      },
    });
    await tx.taskStatusChange.create({
      data: { taskId: created.id, fromStatus: null, toStatus: status, changedById: actor.userId },
    });
    if (blockedByTaskId) {
      await assertDependency(tx, project.id, created.id, blockedByTaskId);
      await tx.taskDependency.create({ data: { taskId: created.id, blockedByTaskId } });
    }
    await recordActivity(tx, {
      organizationId: actor.organizationId,
      projectId: project.id,
      actorId: actor.userId,
      type: "TASK_CREATED",
      clientVisible,
      summary: clientVisible ? `Task added: ${created.title}` : `Internal task added: ${created.title}`,
      entityType: "task",
      entityId: created.id,
    });
    if (assigneeId && assigneeId !== actor.userId) {
      const recipients = await projectRecipients(project.id);
      const recipient = recipients.find((item) => item.userId === assigneeId);
      if (recipient) {
        await queueNotification(tx, {
          organizationId: actor.organizationId,
          userId: assigneeId,
          recipientRole: recipient.role,
          type: "task.assigned",
          title: `Assigned: ${created.title}`,
          body: `You were assigned “${created.title}”.`,
          clientSafe: clientVisible || !isClientRole(recipient.role),
          dedupeKey: `assign:${created.id}:${assigneeId}`,
          linkPath: linkForRole(recipient.role, project.id, "/tasks"),
        });
      }
    }
    return created;
  });
  await processEmailNotifications();
  return task;
}

export async function updateTask(
  actor: Actor,
  taskId: string,
  input: {
    title?: string;
    description?: string | null;
    assigneeId?: string | null;
    milestoneId?: string | null;
    priority?: Priority;
    startDate?: string | null;
    dueDate?: string | null;
    estimateHours?: string | null;
    clientVisible?: boolean;
    status?: TaskStatus;
    blockedByTaskId?: string | null;
  },
) {
  const existing = await prisma.task.findFirst({
    where: { id: taskId, project: projectVisibilityWhere(actor) },
  });
  if (!existing) throw notFound();
  if (isClientRole(actor.role)) throw forbidden("Clients cannot change tasks.");
  const manager = canManageAllProjects(actor.role);
  if (!manager && existing.assigneeId !== actor.userId) {
    throw forbidden("You can update tasks assigned to you.");
  }
  if (!manager && (input.assigneeId !== undefined || input.clientVisible !== undefined || input.estimateHours !== undefined || input.milestoneId !== undefined || input.blockedByTaskId !== undefined)) {
    throw forbidden("Only a project manager can change assignment, visibility, or estimates.");
  }

  const status = input.status ? taskStatusSchema.parse(input.status) : undefined;
  if (status === "DONE") await assertBlockersDone(existing.id);

  let clientVisible = input.clientVisible;
  const assigneeId = input.assigneeId;
  if (assigneeId) {
    const assigneeIsClient = await assertAssignee(existing.projectId, assigneeId);
    if (assigneeIsClient) clientVisible = true;
  }
  if (input.milestoneId) await assertMilestone(existing.projectId, input.milestoneId);
  if (clientVisible && existing.parentTaskId) {
    const parent = await prisma.task.findUnique({ where: { id: existing.parentTaskId } });
    if (parent && !parent.clientVisible) {
      throw new AppError("VISIBILITY", "A subtask cannot be client-visible when its parent is staff-only.");
    }
  }

  const dueChanged = input.dueDate !== undefined && dateKey(parseDate(input.dueDate)) !== dateKey(existing.dueDate);
  const assigneeChanged = assigneeId !== undefined && empty(assigneeId) !== existing.assigneeId;

  const updated = await prisma.$transaction(async (tx) => {
    if (input.blockedByTaskId !== undefined) {
      await tx.taskDependency.deleteMany({ where: { taskId: existing.id } });
      const blocker = empty(input.blockedByTaskId);
      if (blocker) {
        await assertDependency(tx, existing.projectId, existing.id, blocker);
        await tx.taskDependency.create({ data: { taskId: existing.id, blockedByTaskId: blocker } });
      }
    }
    const next = await tx.task.update({
      where: { id: existing.id },
      data: {
        title: input.title?.trim() || undefined,
        description: input.description === undefined ? undefined : empty(input.description),
        assigneeId: assigneeId === undefined ? undefined : empty(assigneeId),
        milestoneId: input.milestoneId === undefined ? undefined : empty(input.milestoneId),
        priority: input.priority,
        startDate: input.startDate === undefined ? undefined : parseDate(input.startDate),
        dueDate: input.dueDate === undefined ? undefined : parseDate(input.dueDate),
        estimateHours: input.estimateHours === undefined ? undefined : parseEstimate(input.estimateHours),
        clientVisible,
        status,
      },
    });
    if (status && status !== existing.status) {
      await tx.taskStatusChange.create({
        data: {
          taskId: existing.id,
          fromStatus: existing.status,
          toStatus: status,
          changedById: actor.userId,
        },
      });
      await recordActivity(tx, {
        organizationId: actor.organizationId,
        projectId: existing.projectId,
        actorId: actor.userId,
        type: "TASK_STATUS_CHANGED",
        clientVisible: next.clientVisible,
        summary: next.clientVisible
          ? `${next.title} is now ${TASK_STATUS_LABEL[status]}.`
          : `Internal task “${next.title}” is now ${TASK_STATUS_LABEL[status]}.`,
        entityType: "task",
        entityId: next.id,
      });
    }
    if (dueChanged) {
      await recordActivity(tx, {
        organizationId: actor.organizationId,
        projectId: existing.projectId,
        actorId: actor.userId,
        type: "DEADLINE_CHANGED",
        clientVisible: next.clientVisible,
        summary: next.clientVisible
          ? `The due date for ${next.title} is now ${dateKey(next.dueDate) ?? "unset"}.`
          : `An internal task due date changed.`,
        entityType: "task",
        entityId: next.id,
      });
    }
    if (assigneeChanged && next.assigneeId) {
      await recordActivity(tx, {
        organizationId: actor.organizationId,
        projectId: existing.projectId,
        actorId: actor.userId,
        type: "TASK_ASSIGNED",
        clientVisible: false,
        summary: `Assignment updated for ${next.title}.`,
        entityType: "task",
        entityId: next.id,
      });
      const recipients = await projectRecipients(existing.projectId);
      const recipient = recipients.find((item) => item.userId === next.assigneeId);
      if (recipient && recipient.userId !== actor.userId) {
        await queueNotification(tx, {
          organizationId: actor.organizationId,
          userId: recipient.userId,
          recipientRole: recipient.role,
          type: "task.assigned",
          title: `Assigned: ${next.title}`,
          body: `You were assigned “${next.title}”.`,
          clientSafe: next.clientVisible || !isClientRole(recipient.role),
          dedupeKey: `assign:${next.id}:${recipient.userId}:${Date.now()}`,
          linkPath: linkForRole(recipient.role, existing.projectId, "/tasks"),
        });
      }
    }
    return next;
  });
  await processEmailNotifications();
  return presentTask(updated, actor);
}

export async function taskHistory(actor: Actor, taskId: string) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: projectVisibilityWhere(actor),
      ...(isClientRole(actor.role) ? { clientVisible: true } : {}),
    },
    include: {
      statusChanges: { orderBy: { createdAt: "asc" }, include: { changedBy: { select: { name: true } } } },
      dependencies: { include: { blockedBy: { select: { id: true, title: true, status: true, clientVisible: true } } } },
    },
  });
  if (!task) throw notFound();
  return {
    ...presentTask(task, actor),
    statusChanges: isClientRole(actor.role)
      ? task.statusChanges.map((change) => ({ ...change, changedBy: { name: "Team" } }))
      : task.statusChanges,
    dependencies: task.dependencies
      .filter((dependency) => !isClientRole(actor.role) || dependency.blockedBy.clientVisible)
      .map((dependency) => dependency.blockedBy),
  };
}

async function assertMilestone(projectId: string, milestoneId: string) {
  const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, projectId } });
  if (!milestone) throw new AppError("VALIDATION", "That milestone is not on this project.");
}

async function assertParent(projectId: string, parentTaskId: string) {
  const parent = await prisma.task.findFirst({ where: { id: parentTaskId, projectId } });
  if (!parent) throw new AppError("VALIDATION", "That parent task is not on this project.");
  if (parent.parentTaskId) throw new AppError("VALIDATION", "Subtasks can only be one level deep.");
}

async function assertAssignee(projectId: string, userId: string): Promise<boolean> {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member || member.role === "READ_ONLY") {
    throw new AppError("VALIDATION", "The assignee must be a project member who can do the work.");
  }
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
  const membership = await prisma.membership.findFirst({
    where: { userId, organizationId: project?.organizationId, revokedAt: null },
  });
  if (!membership) throw new AppError("VALIDATION", "The assignee is not an active member.");
  return isClientRole(membership.role);
}

async function assertDependency(
  tx: Prisma.TransactionClient,
  projectId: string,
  taskId: string,
  blockedByTaskId: string,
) {
  if (blockedByTaskId === taskId) throw new AppError("VALIDATION", "A task cannot depend on itself.");
  const blocker = await tx.task.findFirst({ where: { id: blockedByTaskId, projectId } });
  if (!blocker) throw new AppError("VALIDATION", "The prerequisite task must be on the same project.");
  const reverse = await tx.taskDependency.findFirst({
    where: { taskId: blockedByTaskId, blockedByTaskId: taskId },
  });
  if (reverse) throw new AppError("VALIDATION", "Those tasks would depend on each other.");
}

async function assertBlockersDone(taskId: string) {
  const dependencies = await prisma.taskDependency.findMany({
    where: { taskId },
    include: { blockedBy: { select: { status: true, title: true } } },
  });
  const open = dependencies.filter((dependency) => dependency.blockedBy.status !== "DONE");
  if (open.length > 0) {
    throw new AppError("DEPENDENCY", "Finish the prerequisite tasks before marking this done.");
  }
}

function presentTask<T extends { estimateHours: Prisma.Decimal | null; assignee?: { id: string; name: string } | null }>(
  task: T,
  actor: Actor,
): T {
  if (!isClientRole(actor.role)) {
    if (actor.role === "TEAM_MEMBER" || canManageAllProjects(actor.role) || actor.role === "AGENCY_OWNER") {
      return task;
    }
  }
  return {
    ...task,
    estimateHours: null,
    assignee: null,
  };
}

function empty(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function parseDate(value: string | null | undefined): Date | null {
  try {
    return parseUtcDate(value);
  } catch (error) {
    throw new AppError("VALIDATION", error instanceof Error ? error.message : "Enter a valid date.");
  }
}

function parseEstimate(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(raw)) {
    throw new AppError("VALIDATION", "Estimate hours must be a number.");
  }
  return Number(raw).toFixed(2);
}

function dateKey(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export async function createMilestone(
  actor: Actor,
  projectId: string,
  input: { title: string; description?: string | null; dueDate?: string | null },
) {
  if (!canManageAllProjects(actor.role)) throw forbidden();
  const project = await requireProject(actor, projectId);
  const title = input.title.trim();
  if (title.length < 2) throw new AppError("VALIDATION", "Enter a milestone title.");
  const count = await prisma.milestone.count({ where: { projectId: project.id } });
  return prisma.milestone.create({
    data: {
      projectId: project.id,
      title,
      description: empty(input.description),
      dueDate: parseDate(input.dueDate),
      sortOrder: count + 1,
    },
  });
}

export async function listMilestones(actor: Actor, projectId: string) {
  await requireProject(actor, projectId);
  const client = isClientRole(actor.role);
  const milestones = await prisma.milestone.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
    include: {
      tasks: {
        select: { id: true, title: true, status: true, clientVisible: true, dueDate: true },
        orderBy: { title: "asc" },
      },
    },
  });
  return milestones.map((milestone) => {
    const complete = milestone.tasks.length > 0 && milestone.tasks.every((task) => task.status === "DONE");
    const visible = client ? milestone.tasks.filter((task) => task.clientVisible) : milestone.tasks;
    return {
      id: milestone.id,
      title: milestone.title,
      description: milestone.description,
      dueDate: milestone.dueDate,
      sortOrder: milestone.sortOrder,
      complete,
      taskCount: visible.length,
      doneCount: visible.filter((task) => task.status === "DONE").length,
      tasks: visible.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        dueDate: task.dueDate,
        clientVisible: task.clientVisible,
      })),
    };
  });
}
