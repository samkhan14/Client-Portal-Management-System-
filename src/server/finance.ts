import { prisma } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { canLogTime, canManageAllProjects, canSeeInternalFinancials, isClientRole, projectVisibilityWhere } from "@/lib/authz";
import type { Actor } from "@/lib/auth/types";
import { parseMoney, parseUtcDate } from "@/lib/format";
import { changeRequestStatusSchema, invoiceStatusSchema } from "@/lib/validators";
import { recordActivity } from "@/server/activity";
import { requireProject } from "@/server/projects";

export async function listInvoices(actor: Actor, projectId?: string) {
  if (actor.role === "TEAM_MEMBER") throw forbidden();
  if (isClientRole(actor.role) || canSeeInternalFinancials(actor.role)) {
    return prisma.invoice.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(projectId ? { projectId } : {}),
        project: projectVisibilityWhere(actor),
        ...(isClientRole(actor.role) ? { clientVisible: true } : {}),
      },
      orderBy: { issuedDate: "desc" },
      include: { project: { select: { id: true, name: true, reference: true } } },
    });
  }
  throw forbidden();
}

export async function createInvoice(
  actor: Actor,
  input: {
    projectId: string;
    number: string;
    amount: string;
    issuedDate: string;
    clientVisible?: boolean;
    notes?: string | null;
    status?: "UNPAID" | "PAID" | "VOID";
  },
) {
  if (!canSeeInternalFinancials(actor.role)) throw forbidden();
  const project = await requireProject(actor, input.projectId);
  const number = input.number.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,30}$/.test(number)) {
    throw new AppError("VALIDATION", "Invoice numbers use letters, numbers, and hyphens.");
  }
  let amount: string;
  try {
    amount = parseMoney(input.amount) ?? "";
  } catch (error) {
    throw new AppError("VALIDATION", error instanceof Error ? error.message : "Enter an amount.");
  }
  if (!amount || Number(amount) <= 0) throw new AppError("VALIDATION", "Enter an invoice amount.");
  const issuedDate = parseDate(input.issuedDate);
  if (!issuedDate) throw new AppError("VALIDATION", "Enter an issue date.");
  try {
    return await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          organizationId: actor.organizationId,
          projectId: project.id,
          clientCompanyId: project.clientCompanyId,
          number,
          amount,
          status: input.status ?? "UNPAID",
          issuedDate,
          clientVisible: Boolean(input.clientVisible),
          notes: empty(input.notes),
        },
      });
      await recordActivity(tx, {
        organizationId: actor.organizationId,
        projectId: project.id,
        actorId: actor.userId,
        type: "INVOICE_CHANGED",
        clientVisible: invoice.clientVisible,
        summary: invoice.clientVisible
          ? `Invoice ${invoice.number} was issued.`
          : "An internal invoice record was created.",
        entityType: "invoice",
        entityId: invoice.id,
      });
      return invoice;
    });
  } catch (error) {
    if (isUnique(error)) throw new AppError("VALIDATION", "That invoice number is already used.");
    throw error;
  }
}

export async function setInvoiceStatus(actor: Actor, invoiceId: string, status: "UNPAID" | "PAID" | "VOID") {
  if (!canSeeInternalFinancials(actor.role)) throw forbidden();
  const next = invoiceStatusSchema.parse(status);
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: actor.organizationId, project: projectVisibilityWhere(actor) },
  });
  if (!invoice) throw notFound();
  const updated = await prisma.invoice.update({ where: { id: invoice.id }, data: { status: next } });
  await recordActivity(prisma, {
    organizationId: actor.organizationId,
    projectId: invoice.projectId,
    actorId: actor.userId,
    type: "INVOICE_CHANGED",
    clientVisible: invoice.clientVisible,
    summary: invoice.clientVisible
      ? `Invoice ${invoice.number} is ${next.toLowerCase()}.`
      : "An internal invoice status changed.",
    entityType: "invoice",
    entityId: invoice.id,
  });
  return updated;
}

export async function listChangeRequests(actor: Actor, projectId: string) {
  await requireProject(actor, projectId);
  if (actor.role === "TEAM_MEMBER") return [];
  return prisma.changeRequest.findMany({
    where: {
      projectId,
      ...(isClientRole(actor.role) ? { clientVisible: true } : {}),
      ...(!canSeeInternalFinancials(actor.role) && !isClientRole(actor.role) ? { id: "__none__" } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createChangeRequest(
  actor: Actor,
  projectId: string,
  input: { title: string; description?: string | null; amount: string; clientVisible?: boolean },
) {
  const project = await requireProject(actor, projectId);
  const client = actor.role === "CLIENT_ADMIN";
  if (!client && !canSeeInternalFinancials(actor.role)) throw forbidden();
  const title = input.title.trim();
  if (title.length < 2) throw new AppError("VALIDATION", "Enter a title for the change request.");
  let amount: string;
  try {
    amount = parseMoney(input.amount) ?? "";
  } catch (error) {
    throw new AppError("VALIDATION", error instanceof Error ? error.message : "Enter an amount.");
  }
  if (!amount) throw new AppError("VALIDATION", "Enter an amount.");
  return prisma.changeRequest.create({
    data: {
      projectId: project.id,
      title,
      description: empty(input.description),
      amount,
      clientVisible: client ? true : Boolean(input.clientVisible),
      requestedById: actor.userId,
      status: "REQUESTED",
    },
  });
}

export async function decideChangeRequest(
  actor: Actor,
  changeRequestId: string,
  status: "APPROVED" | "REJECTED",
) {
  if (!canSeeInternalFinancials(actor.role)) throw forbidden();
  const next = changeRequestStatusSchema.parse(status);
  if (next === "REQUESTED") throw new AppError("VALIDATION", "Choose approved or rejected.");
  const request = await prisma.changeRequest.findFirst({
    where: { id: changeRequestId, project: projectVisibilityWhere(actor) },
  });
  if (!request) throw notFound();
  return prisma.changeRequest.update({
    where: { id: request.id },
    data: { status: next, decidedById: actor.userId, decidedAt: new Date() },
  });
}

export async function listTimeEntries(actor: Actor, projectId: string) {
  if (!canLogTime(actor.role)) throw forbidden();
  await requireProject(actor, projectId);
  const entries = await prisma.timeEntry.findMany({
    where: {
      projectId,
      organizationId: actor.organizationId,
      ...(actor.role === "TEAM_MEMBER" ? { userId: actor.userId } : {}),
    },
    orderBy: { workDate: "desc" },
    include: {
      user: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });
  const totals = await prisma.timeEntry.groupBy({
    by: ["billable"],
    where: {
      projectId,
      organizationId: actor.organizationId,
      ...(actor.role === "TEAM_MEMBER" ? { userId: actor.userId } : {}),
    },
    _sum: { minutes: true },
  });
  return { entries, totals };
}

export async function logTime(
  actor: Actor,
  input: { projectId: string; taskId: string; minutes: number; billable?: boolean; workDate: string; note?: string | null },
) {
  if (!canLogTime(actor.role)) throw forbidden();
  const project = await requireProject(actor, input.projectId);
  const task = await prisma.task.findFirst({ where: { id: input.taskId, projectId: project.id } });
  if (!task) throw new AppError("VALIDATION", "Choose a task on this project.");
  if (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > 24 * 60) {
    throw new AppError("VALIDATION", "Enter minutes between 1 and 1440.");
  }
  const workDate = parseDate(input.workDate);
  if (!workDate) throw new AppError("VALIDATION", "Enter the date the work was done.");
  return prisma.timeEntry.create({
    data: {
      organizationId: actor.organizationId,
      projectId: project.id,
      taskId: task.id,
      userId: actor.userId,
      minutes: input.minutes,
      billable: input.billable !== false,
      workDate,
      note: empty(input.note),
    },
  });
}

export function canManageFinance(actor: Actor) {
  return canSeeInternalFinancials(actor.role) || canManageAllProjects(actor.role);
}

function parseDate(value: string | null | undefined) {
  try {
    return parseUtcDate(value);
  } catch (error) {
    throw new AppError("VALIDATION", error instanceof Error ? error.message : "Enter a valid date.");
  }
}

function empty(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function isUnique(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002";
}
