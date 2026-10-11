"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/current";
import { revokeSession, SESSION_COOKIE } from "@/lib/auth/session";
import type { Actor } from "@/lib/auth/types";
import { safeReturnTo, type ActionState } from "@/lib/action-state";
import { AppError, isNextRedirect, publicError } from "@/lib/errors";
import { prioritySchema, projectStatusSchema, taskStatusSchema } from "@/lib/validators";
import { addComment } from "@/server/comments";
import { createNextVersion, createDeliverable, decideDeliverableVersion, submitDeliverableVersion } from "@/server/deliverables";
import { createChangeRequest, createInvoice, decideChangeRequest, logTime, setInvoiceStatus } from "@/server/finance";
import { deleteFile } from "@/server/files";
import { markAllNotificationsRead, markNotificationRead, scanApproachingDeadlines } from "@/server/notifications";
import {
  createClientCompany,
  createInvitation,
  revokeInvitation,
  revokeMembership,
  setOnboardingStep,
  updateOrganization,
} from "@/server/org";
import { addProjectMember, changeProjectStatus, createProject, removeProjectMember, updateProject } from "@/server/projects";
import { createMilestone, createTask, updateTask } from "@/server/tasks";

async function guard(formData: FormData): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (String(formData.get("csrf") ?? "") !== actor.csrfToken) {
    throw new AppError("CSRF", "Your session expired. Refresh the page and try again.", 403);
  }
  return actor;
}

function caught(error: unknown): ActionState {
  if (isNextRedirect(error)) throw error;
  return { error: publicError(error) };
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

export async function logoutAction(formData: FormData): Promise<void> {
  const actor = await guard(formData);
  await revokeSession(actor.sessionId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });
  redirect("/login");
}

export async function createProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const project = await createProject(actor, {
      name: text(formData, "name"),
      reference: text(formData, "reference"),
      clientCompanyId: text(formData, "clientCompanyId"),
      description: text(formData, "description"),
      scope: text(formData, "scope"),
      internalNotes: text(formData, "internalNotes"),
      priority: prioritySchema.parse(text(formData, "priority") || "MEDIUM"),
      startDate: text(formData, "startDate"),
      dueDate: text(formData, "dueDate"),
      agreedFee: text(formData, "agreedFee"),
      agreedFeeClientVisible: formData.get("agreedFeeClientVisible") === "on",
      internalEstimate: text(formData, "internalEstimate"),
      projectManagerId: text(formData, "projectManagerId"),
      memberIds: formData.getAll("memberIds").map(String).filter(Boolean),
    });
    revalidatePath("/projects");
    redirect(`/projects/${project.id}?notice=saved`);
  } catch (error) {
    return caught(error);
  }
}

export async function updateProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const projectId = text(formData, "projectId");
    await updateProject(actor, projectId, {
      name: text(formData, "name"),
      description: text(formData, "description"),
      scope: text(formData, "scope"),
      internalNotes: text(formData, "internalNotes"),
      priority: prioritySchema.parse(text(formData, "priority") || "MEDIUM"),
      startDate: text(formData, "startDate"),
      dueDate: text(formData, "dueDate"),
      agreedFee: text(formData, "agreedFee"),
      agreedFeeClientVisible: formData.get("agreedFeeClientVisible") === "on",
      internalEstimate: text(formData, "internalEstimate"),
    });
    revalidatePath(`/projects/${projectId}`);
    redirect(`${safeReturnTo(formData.get("returnTo"), `/projects/${projectId}`)}?notice=saved`);
  } catch (error) {
    return caught(error);
  }
}

export async function changeStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const projectId = text(formData, "projectId");
    await changeProjectStatus(
      actor,
      projectId,
      projectStatusSchema.parse(text(formData, "status")),
      text(formData, "outstandingRequest"),
    );
    revalidatePath(`/projects/${projectId}`);
    redirect(`${safeReturnTo(formData.get("returnTo"), `/projects/${projectId}`)}?notice=saved`);
  } catch (error) {
    return caught(error);
  }
}

export async function addMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const projectId = text(formData, "projectId");
    await addProjectMember(actor, projectId, text(formData, "userId"));
    revalidatePath(`/projects/${projectId}`);
    redirect(`/projects/${projectId}?notice=saved`);
  } catch (error) {
    return caught(error);
  }
}

export async function removeMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const projectId = text(formData, "projectId");
    await removeProjectMember(actor, projectId, text(formData, "userId"));
    revalidatePath(`/projects/${projectId}`);
    redirect(`/projects/${projectId}?notice=saved`);
  } catch (error) {
    return caught(error);
  }
}

export async function createMilestoneAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const projectId = text(formData, "projectId");
    await createMilestone(actor, projectId, {
      title: text(formData, "title"),
      description: text(formData, "description"),
      dueDate: text(formData, "dueDate"),
    });
    revalidatePath(`/projects/${projectId}`);
    redirect(`${safeReturnTo(formData.get("returnTo"), `/projects/${projectId}`)}?notice=saved`);
  } catch (error) {
    return caught(error);
  }
}

export async function createTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const projectId = text(formData, "projectId");
    await createTask(actor, projectId, {
      title: text(formData, "title"),
      description: text(formData, "description"),
      assigneeId: text(formData, "assigneeId"),
      milestoneId: text(formData, "milestoneId"),
      parentTaskId: text(formData, "parentTaskId"),
      blockedByTaskId: text(formData, "blockedByTaskId"),
      priority: prioritySchema.parse(text(formData, "priority") || "MEDIUM"),
      startDate: text(formData, "startDate"),
      dueDate: text(formData, "dueDate"),
      estimateHours: text(formData, "estimateHours"),
      clientVisible: formData.get("clientVisible") === "on",
    });
    revalidatePath(`/projects/${projectId}/tasks`);
    redirect(`${safeReturnTo(formData.get("returnTo"), `/projects/${projectId}/tasks`)}?notice=saved`);
  } catch (error) {
    return caught(error);
  }
}

export async function updateTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const taskId = text(formData, "taskId");
    const projectId = text(formData, "projectId");
    await updateTask(actor, taskId, {
      title: text(formData, "title") || undefined,
      description: formData.has("description") ? text(formData, "description") : undefined,
      assigneeId: formData.has("assigneeId") ? text(formData, "assigneeId") : undefined,
      milestoneId: formData.has("milestoneId") ? text(formData, "milestoneId") : undefined,
      priority: formData.get("priority") ? prioritySchema.parse(text(formData, "priority")) : undefined,
      startDate: formData.has("startDate") ? text(formData, "startDate") : undefined,
      dueDate: formData.has("dueDate") ? text(formData, "dueDate") : undefined,
      estimateHours: formData.has("estimateHours") ? text(formData, "estimateHours") : undefined,
      clientVisible: formData.get("setVisibility") === "1" ? formData.get("clientVisible") === "on" : undefined,
      status: formData.get("status") ? taskStatusSchema.parse(text(formData, "status")) : undefined,
      blockedByTaskId: formData.has("blockedByTaskId") ? text(formData, "blockedByTaskId") : undefined,
    });
    revalidatePath(`/projects/${projectId}/tasks`);
    redirect(`${safeReturnTo(formData.get("returnTo"), `/projects/${projectId}/tasks`)}?notice=saved`);
  } catch (error) {
    return caught(error);
  }
}

export async function commentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const projectId = text(formData, "projectId");
    await addComment(actor, {
      projectId,
      body: text(formData, "body"),
      clientVisible: formData.get("clientVisible") === "on",
      taskId: text(formData, "taskId") || null,
      deliverableId: text(formData, "deliverableId") || null,
    });
    revalidatePath(`/projects/${projectId}`);
    redirect(`${safeReturnTo(formData.get("returnTo"), `/projects/${projectId}/activity`)}?notice=saved`);
  } catch (error) {
    return caught(error);
  }
}

export async function createDeliverableAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const projectId = text(formData, "projectId");
    await createDeliverable(actor, projectId, {
      title: text(formData, "title"),
      description: text(formData, "description"),
      notes: text(formData, "notes"),
      externalLink: text(formData, "externalLink"),
    });
    redirect(`${safeReturnTo(formData.get("returnTo"), `/projects/${projectId}/deliverables`)}?notice=saved`);
  } catch (error) {
    return caught(error);
  }
}

export async function submitDeliverableAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    await submitDeliverableVersion(actor, text(formData, "versionId"));
    redirect(`${safeReturnTo(formData.get("returnTo"), "/projects")}?notice=submitted`);
  } catch (error) {
    return caught(error);
  }
}

export async function decideDeliverableAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const decision = text(formData, "decision");
    if (decision !== "APPROVED" && decision !== "CHANGES_REQUESTED") {
      throw new AppError("VALIDATION", "Choose approve or request changes.");
    }
    await decideDeliverableVersion(actor, text(formData, "versionId"), decision, text(formData, "feedback"));
    redirect(`${safeReturnTo(formData.get("returnTo"), "/portal")}?notice=decided`);
  } catch (error) {
    return caught(error);
  }
}

export async function nextVersionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    await createNextVersion(actor, text(formData, "deliverableId"), text(formData, "notes"));
    redirect(`${safeReturnTo(formData.get("returnTo"), "/projects")}?notice=saved`);
  } catch (error) {
    return caught(error);
  }
}

export async function deleteFileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    await deleteFile(actor, text(formData, "fileId"));
    redirect(`${safeReturnTo(formData.get("returnTo"), "/projects")}?notice=deleted`);
  } catch (error) {
    return caught(error);
  }
}

export async function inviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const created = await createInvitation(actor, {
      email: text(formData, "email"),
      role: text(formData, "role"),
      clientCompanyId: text(formData, "clientCompanyId") || null,
      projectIds: formData.getAll("projectIds").map(String).filter(Boolean),
    });
    revalidatePath("/team");
    return { error: "", link: `/invite/${created.token}` };
  } catch (error) {
    return caught(error);
  }
}

export async function revokeInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    await revokeInvitation(actor, text(formData, "invitationId"));
    revalidatePath("/team");
    redirect("/team?notice=revoked");
  } catch (error) {
    return caught(error);
  }
}

export async function revokeMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    await revokeMembership(actor, text(formData, "membershipId"));
    revalidatePath("/team");
    redirect("/team?notice=revoked");
  } catch (error) {
    return caught(error);
  }
}

export async function clientCompanyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const company = await createClientCompany(actor, {
      name: text(formData, "name"),
      website: text(formData, "website"),
      notes: text(formData, "notes"),
    });
    redirect(`/clients/${company.id}?notice=saved`);
  } catch (error) {
    return caught(error);
  }
}

export async function onboardingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    await setOnboardingStep(actor, text(formData, "stepId"), formData.get("completed") === "on");
    redirect(`${safeReturnTo(formData.get("returnTo"), "/clients")}?notice=saved`);
  } catch (error) {
    return caught(error);
  }
}

export async function settingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    await updateOrganization(actor, {
      name: text(formData, "name"),
      emailNotificationsEnabled: formData.get("emailNotificationsEnabled") === "on",
      deadlineReminderDays: Number(text(formData, "deadlineReminderDays")),
    });
    revalidatePath("/settings");
    redirect("/settings?notice=saved");
  } catch (error) {
    return caught(error);
  }
}

export async function invoiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const projectId = text(formData, "projectId");
    await createInvoice(actor, {
      projectId,
      number: text(formData, "number"),
      amount: text(formData, "amount"),
      issuedDate: text(formData, "issuedDate"),
      clientVisible: formData.get("clientVisible") === "on",
      notes: text(formData, "notes"),
    });
    redirect(`${safeReturnTo(formData.get("returnTo"), `/projects/${projectId}/invoices`)}?notice=saved`);
  } catch (error) {
    return caught(error);
  }
}

export async function invoiceStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const status = text(formData, "status");
    if (status !== "UNPAID" && status !== "PAID" && status !== "VOID") {
      throw new AppError("VALIDATION", "Choose a payment status.");
    }
    await setInvoiceStatus(actor, text(formData, "invoiceId"), status);
    redirect(`${safeReturnTo(formData.get("returnTo"), "/projects")}?notice=saved`);
  } catch (error) {
    return caught(error);
  }
}

export async function changeRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const projectId = text(formData, "projectId");
    await createChangeRequest(actor, projectId, {
      title: text(formData, "title"),
      description: text(formData, "description"),
      amount: text(formData, "amount"),
      clientVisible: formData.get("clientVisible") === "on",
    });
    redirect(`${safeReturnTo(formData.get("returnTo"), `/projects/${projectId}`)}?notice=saved`);
  } catch (error) {
    return caught(error);
  }
}

export async function decideChangeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const status = text(formData, "status");
    if (status !== "APPROVED" && status !== "REJECTED") {
      throw new AppError("VALIDATION", "Choose approved or rejected.");
    }
    await decideChangeRequest(actor, text(formData, "changeRequestId"), status);
    redirect(`${safeReturnTo(formData.get("returnTo"), "/projects")}?notice=saved`);
  } catch (error) {
    return caught(error);
  }
}

export async function timeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const projectId = text(formData, "projectId");
    await logTime(actor, {
      projectId,
      taskId: text(formData, "taskId"),
      minutes: Number(text(formData, "minutes")),
      billable: formData.get("billable") === "on",
      workDate: text(formData, "workDate"),
      note: text(formData, "note"),
    });
    redirect(`/projects/${projectId}/time?notice=saved`);
  } catch (error) {
    return caught(error);
  }
}

export async function readNotificationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    const id = text(formData, "notificationId");
    if (id === "all") await markAllNotificationsRead(actor.userId, actor.organizationId);
    else await markNotificationRead(actor.userId, actor.organizationId, id);
    redirect(safeReturnTo(formData.get("returnTo"), "/notifications"));
  } catch (error) {
    return caught(error);
  }
}

export async function scanDeadlinesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await guard(formData);
    if (actor.role !== "AGENCY_OWNER" && actor.role !== "PROJECT_MANAGER") {
      throw new AppError("FORBIDDEN", "You do not have access to that.", 403);
    }
    await scanApproachingDeadlines(actor.organizationId);
    redirect("/notifications?notice=scanned");
  } catch (error) {
    return caught(error);
  }
}
