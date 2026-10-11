import { prisma } from "@/lib/db";
import { forbidden } from "@/lib/errors";
import { isClientRole, isInternalRole, projectVisibilityWhere } from "@/lib/authz";
import type { Actor } from "@/lib/auth/types";
import { addUtcDays, utcToday } from "@/lib/format";

export async function internalDashboard(actor: Actor) {
  if (!isInternalRole(actor.role)) throw forbidden();
  const projectWhere = projectVisibilityWhere(actor);
  const today = utcToday();
  const horizon = addUtcDays(today, 14);
  const [byStatus, overdueTasks, milestones, awaitingApproval, workload, waitingOnClient] = await Promise.all([
    prisma.project.groupBy({
      by: ["status"],
      where: projectWhere,
      _count: { _all: true },
    }),
    prisma.task.count({
      where: {
        project: projectWhere,
        status: { not: "DONE" },
        dueDate: { lt: today },
      },
    }),
    prisma.milestone.findMany({
      where: {
        dueDate: { gte: today, lte: horizon },
        project: { AND: [projectWhere, { status: { notIn: ["COMPLETED", "CANCELLED"] } }] },
      },
      orderBy: { dueDate: "asc" },
      take: 8,
      select: {
        id: true,
        title: true,
        dueDate: true,
        project: { select: { id: true, name: true, reference: true } },
      },
    }),
    prisma.deliverableVersion.count({
      where: { status: "SUBMITTED", deliverable: { project: projectWhere } },
    }),
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: { project: projectWhere, status: { not: "DONE" }, assigneeId: { not: null } },
      _count: { _all: true },
    }),
    prisma.project.count({
      where: { AND: [projectWhere, { status: "WAITING_ON_CLIENT" }] },
    }),
  ]);
  const assigneeIds = workload.map((row) => row.assigneeId).filter((id): id is string => Boolean(id));
  const people = assigneeIds.length
    ? await prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } })
    : [];
  const names = new Map(people.map((person) => [person.id, person.name]));
  return {
    projectsByStatus: byStatus.map((row) => ({ status: row.status, count: row._count._all })),
    overdueTasks,
    upcomingMilestones: milestones,
    awaitingApproval,
    waitingOnClient,
    workload: workload
      .map((row) => ({
        assigneeId: row.assigneeId,
        name: names.get(row.assigneeId ?? "") ?? "Unassigned",
        openTasks: row._count._all,
      }))
      .sort((a, b) => b.openTasks - a.openTasks),
  };
}

export async function clientDashboard(actor: Actor) {
  if (!isClientRole(actor.role)) throw forbidden();
  const projectWhere = projectVisibilityWhere(actor);
  const today = utcToday();
  const [projects, pendingApprovals, overdueTasks, waiting] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere,
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        name: true,
        reference: true,
        status: true,
        dueDate: true,
        outstandingRequest: true,
        agreedFee: true,
        agreedFeeClientVisible: true,
      },
    }),
    prisma.deliverableVersion.count({
      where: {
        status: "SUBMITTED",
        deliverable: { project: projectWhere },
      },
    }),
    prisma.task.count({
      where: {
        project: projectWhere,
        clientVisible: true,
        status: { not: "DONE" },
        dueDate: { lt: today },
      },
    }),
    prisma.project.findMany({
      where: { AND: [projectWhere, { status: "WAITING_ON_CLIENT" }] },
      select: { id: true, name: true, outstandingRequest: true },
      take: 8,
    }),
  ]);
  return {
    projects: projects.map((project) => ({
      ...project,
      agreedFee: project.agreedFeeClientVisible ? project.agreedFee : null,
    })),
    pendingApprovals,
    overdueTasks,
    waiting,
  };
}
