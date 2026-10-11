import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { canApproveDeliverables, canDraftDeliverables, isClientRole, projectVisibilityWhere } from "@/lib/authz";
import type { Actor } from "@/lib/auth/types";
import { recordActivity } from "@/server/activity";
import { notifyRecipients, processEmailNotifications } from "@/server/notifications";
import { requireProject } from "@/server/projects";

const linkSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .refine((value) => !value || /^https?:\/\//i.test(value), "Links must start with http:// or https://.");

export async function listDeliverables(actor: Actor, projectId: string) {
  await requireProject(actor, projectId);
  const deliverables = await prisma.deliverable.findMany({
    where: {
      projectId,
      ...(isClientRole(actor.role)
        ? { versions: { some: { status: { not: "DRAFT" } } } }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      versions: {
        where: isClientRole(actor.role) ? { status: { not: "DRAFT" } } : {},
        orderBy: { versionNumber: "desc" },
        include: {
          files: { where: { deletedAt: null }, select: { id: true, originalName: true, clientVisible: true, sizeBytes: true } },
          reviewer: { select: { name: true } },
          submittedBy: { select: { name: true } },
        },
      },
    },
  });
  return deliverables.map((deliverable) => ({
    ...deliverable,
    versions: deliverable.versions.map((version) => ({
      ...version,
      files: version.files.filter((file) => !isClientRole(actor.role) || file.clientVisible),
      submittedBy: isClientRole(actor.role) ? null : version.submittedBy,
      reviewer: version.reviewer ? { name: version.reviewer.name } : null,
    })),
  }));
}

export async function createDeliverable(
  actor: Actor,
  projectId: string,
  input: { title: string; description?: string | null; notes?: string | null; externalLink?: string | null },
) {
  if (!canDraftDeliverables(actor.role)) throw forbidden();
  const project = await requireProject(actor, projectId);
  const title = input.title.trim();
  if (title.length < 2) throw new AppError("VALIDATION", "Enter a deliverable title.");
  const externalLink = linkSchema.parse(input.externalLink ?? null);
  return prisma.$transaction(async (tx) => {
    const deliverable = await tx.deliverable.create({
      data: {
        projectId: project.id,
        title,
        description: empty(input.description),
        createdById: actor.userId,
      },
    });
    const version = await tx.deliverableVersion.create({
      data: {
        deliverableId: deliverable.id,
        versionNumber: 1,
        notes: empty(input.notes),
        externalLink: externalLink || null,
        status: "DRAFT",
      },
    });
    return { deliverable, version };
  });
}

export async function submitDeliverableVersion(actor: Actor, versionId: string) {
  if (!canDraftDeliverables(actor.role)) throw forbidden();
  const version = await loadVersion(actor, versionId, true);
  if (version.status !== "DRAFT") throw new AppError("STATE", "Only a draft can be submitted.");
  const files = await prisma.fileAsset.count({
    where: { deliverableVersionId: version.id, deletedAt: null },
  });
  if (!version.externalLink && files === 0) {
    throw new AppError("STATE", "Add a file or a link before submitting.");
  }
  await prisma.$transaction(async (tx) => {
    const updated = await tx.deliverableVersion.updateMany({
      where: { id: version.id, status: "DRAFT" },
      data: { status: "SUBMITTED", submittedAt: new Date(), submittedById: actor.userId },
    });
    if (updated.count !== 1) throw new AppError("STATE", "This version was already submitted.");
    await tx.fileAsset.updateMany({
      where: { deliverableVersionId: version.id, deletedAt: null },
      data: { clientVisible: true },
    });
    await recordActivity(tx, {
      organizationId: actor.organizationId,
      projectId: version.deliverable.projectId,
      actorId: actor.userId,
      type: "DELIVERABLE_SUBMITTED",
      clientVisible: true,
      summary: `“${version.deliverable.title}” version ${version.versionNumber} was submitted for review.`,
      entityType: "deliverable_version",
      entityId: version.id,
    });
    await notifyRecipients(tx, {
      organizationId: actor.organizationId,
      projectId: version.deliverable.projectId,
      actorId: actor.userId,
      type: "deliverable.submitted",
      title: `Review needed: ${version.deliverable.title}`,
      body: `Version ${version.versionNumber} was submitted for review.`,
      dedupeKey: `submitted:${version.id}`,
      clientSafe: true,
      suffix: "/deliverables",
    });
  });
  await processEmailNotifications();
}

export async function decideDeliverableVersion(
  actor: Actor,
  versionId: string,
  decision: "APPROVED" | "CHANGES_REQUESTED",
  feedback?: string | null,
) {
  if (!canApproveDeliverables(actor.role)) {
    throw forbidden("Only a client admin can approve or request changes.");
  }
  const version = await loadVersion(actor, versionId, false);
  const note = (feedback ?? "").trim();
  if (decision === "CHANGES_REQUESTED" && note.length < 3) {
    throw new AppError("VALIDATION", "Describe the changes you need.");
  }
  if (decision !== "APPROVED" && decision !== "CHANGES_REQUESTED") {
    throw new AppError("VALIDATION", "Choose approve or request changes.");
  }
  await prisma.$transaction(async (tx) => {
    const updated = await tx.deliverableVersion.updateMany({
      where: { id: version.id, status: "SUBMITTED" },
      data: {
        status: decision,
        reviewerId: actor.userId,
        decidedAt: new Date(),
        feedback: note || null,
      },
    });
    if (updated.count !== 1) {
      throw new AppError("CONFLICT", "This version was already decided.", 409);
    }
    await recordActivity(tx, {
      organizationId: actor.organizationId,
      projectId: version.deliverable.projectId,
      actorId: actor.userId,
      type: decision === "APPROVED" ? "DELIVERABLE_APPROVED" : "DELIVERABLE_CHANGES_REQUESTED",
      clientVisible: true,
      summary:
        decision === "APPROVED"
          ? `“${version.deliverable.title}” version ${version.versionNumber} was approved.`
          : `Changes were requested on “${version.deliverable.title}” version ${version.versionNumber}.`,
      entityType: "deliverable_version",
      entityId: version.id,
    });
    await notifyRecipients(tx, {
      organizationId: actor.organizationId,
      projectId: version.deliverable.projectId,
      actorId: actor.userId,
      type: decision === "APPROVED" ? "deliverable.approved" : "deliverable.changes_requested",
      title:
        decision === "APPROVED"
          ? `Approved: ${version.deliverable.title}`
          : `Changes requested: ${version.deliverable.title}`,
      body:
        decision === "APPROVED"
          ? `Version ${version.versionNumber} was approved.`
          : `Version ${version.versionNumber} needs changes.`,
      dedupeKey: `decision:${version.id}:${decision}`,
      clientSafe: true,
      suffix: "/deliverables",
    });
  });
  await processEmailNotifications();
}

export async function createNextVersion(actor: Actor, deliverableId: string, notes?: string | null) {
  if (!canDraftDeliverables(actor.role)) throw forbidden();
  const deliverable = await prisma.deliverable.findFirst({
    where: { id: deliverableId, project: projectVisibilityWhere(actor) },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  if (!deliverable) throw notFound();
  const latest = deliverable.versions[0];
  if (!latest || (latest.status !== "CHANGES_REQUESTED" && latest.status !== "APPROVED")) {
    throw new AppError("STATE", "Start a new version only after the current one has a decision.");
  }
  return prisma.deliverableVersion.create({
    data: {
      deliverableId: deliverable.id,
      versionNumber: latest.versionNumber + 1,
      notes: empty(notes),
      status: "DRAFT",
    },
  });
}

async function loadVersion(actor: Actor, versionId: string, includeDrafts: boolean) {
  const version = await prisma.deliverableVersion.findFirst({
    where: {
      id: versionId,
      deliverable: { project: projectVisibilityWhere(actor) },
      ...(!includeDrafts && isClientRole(actor.role) ? { status: { not: "DRAFT" } } : {}),
    },
    include: { deliverable: true },
  });
  if (!version) throw notFound();
  return version;
}

function empty(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}
