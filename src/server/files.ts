import { randomUUID } from "node:crypto";
import type { FileCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { canUpload, isClientRole, projectVisibilityWhere } from "@/lib/authz";
import type { Actor } from "@/lib/auth/types";
import { assertFileAllowed, readStoredFile, removeStoredFile, writeStoredFile } from "@/lib/files";
import { fileCategorySchema } from "@/lib/validators";
import { recordActivity } from "@/server/activity";
import { requireProject } from "@/server/projects";

export async function listFiles(actor: Actor, projectId: string, category?: string) {
  await requireProject(actor, projectId);
  const files = await prisma.fileAsset.findMany({
    where: {
      projectId,
      deletedAt: null,
      project: projectVisibilityWhere(actor),
      ...(isClientRole(actor.role) ? { clientVisible: true } : {}),
      ...(category ? { category: fileCategorySchema.parse(category) } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      category: true,
      clientVisible: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
    },
  });
  return files.map((file) => ({
    ...file,
    uploadedBy: isClientRole(actor.role) ? null : file.uploadedBy,
  }));
}

export async function uploadProjectFile(
  actor: Actor,
  input: {
    projectId: string;
    originalName: string;
    mimeType: string;
    bytes: Buffer;
    category?: FileCategory | string;
    clientVisible?: boolean;
    deliverableVersionId?: string | null;
    commentId?: string | null;
    taskId?: string | null;
  },
) {
  if (!canUpload(actor.role)) throw forbidden();
  const project = await requireProject(actor, input.projectId);
  const safeName = assertFileAllowed(input.originalName, input.mimeType, input.bytes);
  const category = fileCategorySchema.parse(input.category ?? "OTHER");
  let clientVisible = Boolean(input.clientVisible);
  let deliverableVersionId: string | null = null;
  if (input.deliverableVersionId) {
    const version = await prisma.deliverableVersion.findFirst({
      where: { id: input.deliverableVersionId, deliverable: { projectId: project.id } },
    });
    if (!version) throw notFound();
    if (version.status !== "DRAFT") {
      throw new AppError("STATE", "Files can only be added to a draft version.");
    }
    deliverableVersionId = version.id;
    clientVisible = false;
  }
  if (input.taskId) {
    const task = await prisma.task.findFirst({ where: { id: input.taskId, projectId: project.id } });
    if (!task) throw notFound();
    if (clientVisible && !task.clientVisible) {
      throw new AppError("VISIBILITY", "A client-visible file cannot be attached to a staff-only task.");
    }
  }
  if (input.commentId) {
    const comment = await prisma.comment.findFirst({ where: { id: input.commentId, projectId: project.id } });
    if (!comment) throw notFound();
    clientVisible = comment.clientVisible;
  }
  const file = await prisma.fileAsset.create({
    data: {
      organizationId: actor.organizationId,
      projectId: project.id,
      uploadedById: actor.userId,
      category,
      originalName: safeName,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.length,
      storageKey: `pending/${randomUUID()}`,
      clientVisible,
      deliverableVersionId,
      commentId: input.commentId || null,
      taskId: input.taskId || null,
    },
  });
  const storageKey = `${actor.organizationId}/${file.id}`;
  try {
    await writeStoredFile(storageKey, input.bytes);
    await prisma.fileAsset.update({ where: { id: file.id }, data: { storageKey } });
  } catch (error) {
    await prisma.fileAsset.delete({ where: { id: file.id } }).catch(() => undefined);
    throw error;
  }
  await recordActivity(prisma, {
    organizationId: actor.organizationId,
    projectId: project.id,
    actorId: actor.userId,
    type: "FILE_UPLOADED",
    clientVisible,
    summary: clientVisible ? `Shared file added: ${safeName}` : "An internal file was added.",
    entityType: "file",
    entityId: file.id,
  });
  return { id: file.id };
}

export async function readFileForActor(actor: Actor, fileId: string) {
  const file = await prisma.fileAsset.findFirst({
    where: {
      id: fileId,
      deletedAt: null,
      project: projectVisibilityWhere(actor),
      ...(isClientRole(actor.role) ? { clientVisible: true } : {}),
    },
  });
  if (!file) throw notFound();
  const bytes = await readStoredFile(file.storageKey);
  return { file, bytes };
}

export async function deleteFile(actor: Actor, fileId: string) {
  const file = await prisma.fileAsset.findFirst({
    where: { id: fileId, deletedAt: null, project: projectVisibilityWhere(actor) },
  });
  if (!file) throw notFound();
  if (isClientRole(actor.role)) throw forbidden();
  const manager = actor.role === "AGENCY_OWNER" || actor.role === "PROJECT_MANAGER";
  if (!manager && file.uploadedById !== actor.userId) throw forbidden();
  await prisma.fileAsset.update({ where: { id: file.id }, data: { deletedAt: new Date() } });
  await removeStoredFile(file.storageKey);
}
