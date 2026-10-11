import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { addComment } from "@/server/comments";
import { internalDashboard } from "@/server/dashboard";
import { createDeliverable, submitDeliverableVersion } from "@/server/deliverables";
import { queueNotification, scanApproachingDeadlines } from "@/server/notifications";
import { changeProjectStatus, createProject } from "@/server/projects";
import { createMilestone, createTask } from "@/server/tasks";
import { createActor, createCompany } from "./helpers";

describe("notifications, search, and dashboard aggregates", () => {
  it("dedupes notifications for the same user and event", async () => {
    const owner = await createActor({ role: "AGENCY_OWNER" });
    const input = {
      organizationId: owner.organizationId,
      userId: owner.userId,
      recipientRole: "AGENCY_OWNER" as const,
      type: "task.assigned",
      title: "Assigned",
      body: "You were assigned a task.",
      clientSafe: true,
      dedupeKey: `assign:task-1:${owner.userId}`,
      linkPath: "/projects/task-1",
    };
    await queueNotification(prisma, input);
    await queueNotification(prisma, input);
    const rows = await prisma.notification.findMany({ where: { userId: owner.userId } });
    expect(rows.filter((row) => row.channel === "IN_APP")).toHaveLength(1);
    expect(rows.filter((row) => row.channel === "EMAIL")).toHaveLength(1);
  });

  it("does not notify clients about internal comments and dedupes deadline scans", async () => {
    const owner = await createActor({ role: "AGENCY_OWNER" });
    const member = await createActor({ role: "TEAM_MEMBER", orgId: owner.organizationId, email: "member@northline.test" });
    const company = await createCompany(owner.organizationId);
    const client = await createActor({
      role: "CLIENT_ADMIN",
      orgId: owner.organizationId,
      clientCompanyId: company.id,
      email: "ada@acme.test",
    });
    const project = await createProject(owner, {
      name: "Website",
      reference: "WEB-3",
      clientCompanyId: company.id,
      priority: "MEDIUM",
      projectManagerId: owner.userId,
      memberIds: [member.userId, client.userId],
    });
    await addComment(owner, { projectId: project.id, body: "Secret staffing note", clientVisible: false });
    const clientNotes = await prisma.notification.findMany({ where: { userId: client.userId } });
    expect(clientNotes).toHaveLength(0);
    const due = new Date();
    due.setUTCHours(0, 0, 0, 0);
    due.setUTCDate(due.getUTCDate() + 1);
    await createTask(owner, project.id, {
      title: "Due tomorrow",
      assigneeId: member.userId,
      dueDate: due.toISOString().slice(0, 10),
      clientVisible: false,
    });
    const first = await scanApproachingDeadlines(owner.organizationId);
    const second = await scanApproachingDeadlines(owner.organizationId);
    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    const reminders = await prisma.notification.count({
      where: { userId: member.userId, type: "deadline.approaching", channel: "IN_APP" },
    });
    expect(reminders).toBe(1);
  });

  it("aggregates the internal dashboard without loading every row into the result", async () => {
    const owner = await createActor({ role: "AGENCY_OWNER" });
    const member = await createActor({ role: "TEAM_MEMBER", orgId: owner.organizationId, email: "member@northline.test" });
    const company = await createCompany(owner.organizationId);
    const active = await createProject(owner, {
      name: "Active",
      reference: "A-1",
      clientCompanyId: company.id,
      priority: "HIGH",
      projectManagerId: owner.userId,
      memberIds: [member.userId],
    });
    const paused = await createProject(owner, {
      name: "Paused",
      reference: "A-2",
      clientCompanyId: company.id,
      priority: "LOW",
      projectManagerId: owner.userId,
    });
    await changeProjectStatus(owner, active.id, "IN_PROGRESS");
    await changeProjectStatus(owner, paused.id, "IN_PROGRESS");
    await changeProjectStatus(owner, paused.id, "WAITING_ON_CLIENT", "Need the logo.");
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 2);
    await createTask(owner, active.id, {
      title: "Late",
      assigneeId: member.userId,
      dueDate: yesterday.toISOString().slice(0, 10),
      status: "TODO",
    });
    const soon = new Date();
    soon.setUTCDate(soon.getUTCDate() + 3);
    await createMilestone(owner, active.id, { title: "Design review", dueDate: soon.toISOString().slice(0, 10) });
    const deliverable = await createDeliverable(owner, active.id, {
      title: "Concepts",
      externalLink: "https://example.com/concepts",
    });
    await submitDeliverableVersion(owner, deliverable.version.id);
    const dashboard = await internalDashboard(owner);
    expect(dashboard.overdueTasks).toBe(1);
    expect(dashboard.awaitingApproval).toBe(1);
    expect(dashboard.waitingOnClient).toBe(1);
    expect(dashboard.upcomingMilestones).toHaveLength(1);
    expect(dashboard.projectsByStatus.find((row) => row.status === "IN_PROGRESS")?.count).toBe(1);
    expect(dashboard.projectsByStatus.find((row) => row.status === "WAITING_ON_CLIENT")?.count).toBe(1);
    expect(dashboard.workload.find((row) => row.assigneeId === member.userId)?.openTasks).toBe(1);
  });
});
