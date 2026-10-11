import { Prisma, type Priority, type ProjectStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { parseMoney, parseUtcDate } from "@/lib/format";
import {
  canChangeProjectStatus,
  canManageAllProjects,
  canTransition,
  isClientRole,
  projectMemberRoleFor,
  projectVisibilityWhere,
} from "@/lib/authz";
import type { Actor } from "@/lib/auth/types";
import { prioritySchema, projectStatusSchema, referenceSchema } from "@/lib/validators";
import { PROJECT_STATUS_LABEL } from "@/lib/constants";
import { recordActivity } from "@/server/activity";
import { notifyRecipients, processEmailNotifications } from "@/server/notifications";

const text = z.string().trim().max(8000).optional().nullable();

const createSchema = z.object({
  name: z.string().trim().min(2, "Enter a project name.").max(160),
  reference: referenceSchema,
  clientCompanyId: z.string().min(1),
  description: text,
  scope: text,
  internalNotes: text,
  priority: prioritySchema,
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  agreedFee: z.string().optional().nullable(),
  agreedFeeClientVisible: z.boolean().optional(),
  internalEstimate: z.string().optional().nullable(),
  projectManagerId: z.string().min(1, "Choose a project manager."),
  memberIds: z.array(z.string()).optional(),
});

export async function requireProject(actor: Actor, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { AND: [{ id: projectId }, projectVisibilityWhere(actor)] },
    include: {
      clientCompany: { select: { id: true, name: true, website: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!project) throw notFound();
  return project;
}

export async function listProjects(
  actor: Actor,
  filters: {
    q?: string;
    status?: string;
    priority?: string;
    clientCompanyId?: string;
    page: number;
    pageSize: number;
  },
) {
  const q = filters.q?.trim();
  const where: Prisma.ProjectWhereInput = {
    AND: [
      projectVisibilityWhere(actor),
      filters.status ? { status: projectStatusSchema.parse(filters.status) } : {},
      filters.priority ? { priority: prioritySchema.parse(filters.priority) } : {},
      filters.clientCompanyId && !isClientRole(actor.role) ? { clientCompanyId: filters.clientCompanyId } : {},
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { reference: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };
  const [total, items] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      include: { clientCompany: { select: { id: true, name: true } } },
    }),
  ]);
  return { total, items };
}

export async function createProject(actor: Actor, input: unknown) {
  if (!canManageAllProjects(actor.role)) throw forbidden();
  const data = createSchema.parse(input);
  const company = await prisma.clientCompany.findFirst({
    where: { id: data.clientCompanyId, organizationId: actor.organizationId },
  });
  if (!company) throw new AppError("VALIDATION", "Choose a client company in this organization.");

  const memberIds = [...new Set([data.projectManagerId, ...(data.memberIds ?? []), actor.userId])];
  const memberships = await prisma.membership.findMany({
    where: { organizationId: actor.organizationId, userId: { in: memberIds }, revokedAt: null },
  });
  if (memberships.length !== memberIds.length) {
    throw new AppError("VALIDATION", "Every person must be an active member of this organization.");
  }
  const manager = memberships.find((membership) => membership.userId === data.projectManagerId);
  if (!manager || (manager.role !== "AGENCY_OWNER" && manager.role !== "PROJECT_MANAGER")) {
    throw new AppError("VALIDATION", "The project manager must be an owner or project manager.");
  }
  for (const membership of memberships) {
    if (isClientRole(membership.role) && membership.clientCompanyId !== company.id) {
      throw new AppError("VALIDATION", "Client members must belong to the project's client company.");
    }
  }

  let agreedFee: string | null = null;
  let internalEstimate: string | null = null;
  try {
    agreedFee = parseMoney(data.agreedFee);
    internalEstimate = parseMoney(data.internalEstimate);
  } catch (error) {
    throw new AppError("VALIDATION", error instanceof Error ? error.message : "Check the amounts.");
  }

  try {
    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          organizationId: actor.organizationId,
          clientCompanyId: company.id,
          name: data.name,
          reference: data.reference,
          description: emptyToNull(data.description),
          scope: emptyToNull(data.scope),
          internalNotes: emptyToNull(data.internalNotes),
          priority: data.priority,
          startDate: parseDateField(data.startDate),
          dueDate: parseDateField(data.dueDate),
          agreedFee,
          agreedFeeClientVisible: Boolean(data.agreedFeeClientVisible),
          internalEstimate,
          createdById: actor.userId,
          status: "PLANNING",
        },
      });
      await tx.projectMember.createMany({
        data: memberships.map((membership) => ({
          projectId: created.id,
          userId: membership.userId,
          role: projectMemberRoleFor(membership.role) ?? "TEAM_MEMBER",
        })),
      });
      await recordActivity(tx, {
        organizationId: actor.organizationId,
        projectId: created.id,
        actorId: actor.userId,
        type: "PROJECT_CREATED",
        clientVisible: true,
        summary: `Project ${created.name} (${created.reference}) was created.`,
        entityType: "project",
        entityId: created.id,
      });
      return created;
    });
    return project;
  } catch (error) {
    if (isUnique(error)) throw new AppError("VALIDATION", "That project reference is already used.");
    throw error;
  }
}

export async function updateProject(
  actor: Actor,
  projectId: string,
  input: {
    name?: string;
    description?: string | null;
    scope?: string | null;
    internalNotes?: string | null;
    priority?: Priority;
    startDate?: string | null;
    dueDate?: string | null;
    agreedFee?: string | null;
    agreedFeeClientVisible?: boolean;
    internalEstimate?: string | null;
  },
) {
  if (!canManageAllProjects(actor.role)) throw forbidden();
  const project = await requireProject(actor, projectId);
  const name = input.name?.trim();
  if (name !== undefined && name.length < 2) throw new AppError("VALIDATION", "Enter a project name.");
  let agreedFee: Prisma.Decimal | string | null = project.agreedFee;
  let internalEstimate: Prisma.Decimal | string | null = project.internalEstimate;
  try {
    if (input.agreedFee !== undefined) agreedFee = parseMoney(input.agreedFee);
    if (input.internalEstimate !== undefined) internalEstimate = parseMoney(input.internalEstimate);
  } catch (error) {
    throw new AppError("VALIDATION", error instanceof Error ? error.message : "Check the amounts.");
  }
  const dueChanged = input.dueDate !== undefined && dateKey(parseDateField(input.dueDate)) !== dateKey(project.dueDate);
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.project.update({
      where: { id: project.id },
      data: {
        name: name || undefined,
        description: input.description === undefined ? undefined : emptyToNull(input.description),
        scope: input.scope === undefined ? undefined : emptyToNull(input.scope),
        internalNotes: input.internalNotes === undefined ? undefined : emptyToNull(input.internalNotes),
        priority: input.priority,
        startDate: input.startDate === undefined ? undefined : parseDateField(input.startDate),
        dueDate: input.dueDate === undefined ? undefined : parseDateField(input.dueDate),
        agreedFee: agreedFee === null ? null : agreedFee,
        agreedFeeClientVisible: input.agreedFeeClientVisible,
        internalEstimate: internalEstimate === null ? null : internalEstimate,
      },
    });
    await recordActivity(tx, {
      organizationId: actor.organizationId,
      projectId: project.id,
      actorId: actor.userId,
      type: "PROJECT_UPDATED",
      clientVisible: false,
      summary: `Project details were updated.`,
      entityType: "project",
      entityId: project.id,
    });
    if (dueChanged) {
      await recordActivity(tx, {
        organizationId: actor.organizationId,
        projectId: project.id,
        actorId: actor.userId,
        type: "DEADLINE_CHANGED",
        clientVisible: true,
        summary: `The project due date is now ${dateKey(next.dueDate) ?? "unset"}.`,
        entityType: "project",
        entityId: project.id,
      });
    }
    return next;
  });
  return updated;
}

export async function changeProjectStatus(
  actor: Actor,
  projectId: string,
  status: ProjectStatus,
  outstandingRequest?: string | null,
) {
  if (!canChangeProjectStatus(actor.role)) throw forbidden();
  const project = await requireProject(actor, projectId);
  const nextStatus = projectStatusSchema.parse(status);
  if (project.status === nextStatus) return project;
  if (!canTransition(project.status, nextStatus)) {
    throw new AppError(
      "STATUS",
      `Cannot move this project from ${PROJECT_STATUS_LABEL[project.status]} to ${PROJECT_STATUS_LABEL[nextStatus]}.`,
    );
  }
  const request = (outstandingRequest ?? "").trim();
  if (nextStatus === "WAITING_ON_CLIENT" && request.length < 3) {
    throw new AppError("STATUS", "Waiting on the client requires a client-visible outstanding request.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: project.id },
      data: {
        status: nextStatus,
        outstandingRequest: nextStatus === "WAITING_ON_CLIENT" ? request : project.outstandingRequest,
      },
    });
    const summary =
      nextStatus === "WAITING_ON_CLIENT"
        ? `Waiting on the client: ${request}`
        : `Project status is now ${PROJECT_STATUS_LABEL[nextStatus]}.`;
    await recordActivity(tx, {
      organizationId: actor.organizationId,
      projectId: project.id,
      actorId: actor.userId,
      type: "PROJECT_STATUS_CHANGED",
      clientVisible: true,
      summary,
      entityType: "project",
      entityId: project.id,
    });
    await notifyRecipients(tx, {
      organizationId: actor.organizationId,
      projectId: project.id,
      actorId: actor.userId,
      type: "project.status_changed",
      title: `${project.name} is ${PROJECT_STATUS_LABEL[nextStatus].toLowerCase()}`,
      body: summary,
      dedupeKey: `status:${project.id}:${nextStatus}:${Date.now()}`,
      clientSafe: true,
    });
  });
  await processEmailNotifications();
  return requireProject(actor, projectId);
}

export async function addProjectMember(actor: Actor, projectId: string, userId: string) {
  if (!canManageAllProjects(actor.role)) throw forbidden();
  const project = await requireProject(actor, projectId);
  const membership = await prisma.membership.findFirst({
    where: { organizationId: actor.organizationId, userId, revokedAt: null },
  });
  if (!membership) throw new AppError("VALIDATION", "That person is not an active member of this organization.");
  if (isClientRole(membership.role) && membership.clientCompanyId !== project.clientCompanyId) {
    throw new AppError("VALIDATION", "Client members must belong to the project's client company.");
  }
  const role = projectMemberRoleFor(membership.role);
  if (!role) throw new AppError("VALIDATION", "That role cannot be added to a project.");
  await prisma.$transaction(async (tx) => {
    await tx.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId } },
      create: { projectId: project.id, userId, role },
      update: { role },
    });
    await recordActivity(tx, {
      organizationId: actor.organizationId,
      projectId: project.id,
      actorId: actor.userId,
      type: "MEMBERSHIP_CHANGED",
      clientVisible: false,
      summary: "A project member was added or updated.",
      entityType: "project_member",
      entityId: userId,
    });
  });
}

export async function removeProjectMember(actor: Actor, projectId: string, userId: string) {
  if (!canManageAllProjects(actor.role)) throw forbidden();
  const project = await requireProject(actor, projectId);
  await prisma.$transaction(async (tx) => {
    await tx.projectMember.deleteMany({ where: { projectId: project.id, userId } });
    await recordActivity(tx, {
      organizationId: actor.organizationId,
      projectId: project.id,
      actorId: actor.userId,
      type: "MEMBERSHIP_CHANGED",
      clientVisible: false,
      summary: "A project member was removed.",
      entityType: "project_member",
      entityId: userId,
    });
  });
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function parseDateField(value: string | null | undefined): Date | null {
  try {
    return parseUtcDate(value);
  } catch (error) {
    throw new AppError("VALIDATION", error instanceof Error ? error.message : "Enter a valid date.");
  }
}

function dateKey(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function isUnique(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002";
}

export function presentProject<T extends {
  internalNotes: string | null;
  internalEstimate: Prisma.Decimal | null;
  agreedFee: Prisma.Decimal | null;
  agreedFeeClientVisible: boolean;
}>(project: T, actor: Actor) {
  const client = isClientRole(actor.role);
  const finance = !client || project.agreedFeeClientVisible;
  const internalFinance = actor.role === "AGENCY_OWNER" || actor.role === "PROJECT_MANAGER";
  return {
    ...project,
    internalNotes: client ? null : project.internalNotes,
    internalEstimate: internalFinance ? project.internalEstimate : null,
    agreedFee: finance ? project.agreedFee : null,
    agreedFeeClientVisible: client ? project.agreedFeeClientVisible && project.agreedFee !== null : project.agreedFeeClientVisible,
  };
}
