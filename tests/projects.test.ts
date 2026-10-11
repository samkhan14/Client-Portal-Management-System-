import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { progressForProject } from "@/lib/progress";
import { changeProjectStatus, createProject, listProjects } from "@/server/projects";
import { createMilestone, createTask, listTasks, updateTask } from "@/server/tasks";
import { createActor, createCompany } from "./helpers";

async function base() {
  const owner = await createActor({ role: "AGENCY_OWNER" });
  const pm = await createActor({ role: "PROJECT_MANAGER", orgId: owner.organizationId, email: "pm@northline.test" });
  const member = await createActor({ role: "TEAM_MEMBER", orgId: owner.organizationId, email: "member@northline.test" });
  const company = await createCompany(owner.organizationId, "Acme");
  const other = await createCompany(owner.organizationId, "Other");
  const client = await createActor({
    role: "CLIENT_ADMIN",
    orgId: owner.organizationId,
    clientCompanyId: company.id,
    email: "ada@acme.test",
  });
  const project = await createProject(owner, {
    name: "Website",
    reference: "WEB-1",
    clientCompanyId: company.id,
    priority: "MEDIUM",
    projectManagerId: pm.userId,
    memberIds: [member.userId, client.userId],
  });
  const second = await createProject(pm, {
    name: "Other site",
    reference: "OTH-1",
    clientCompanyId: other.id,
    priority: "LOW",
    projectManagerId: pm.userId,
  });
  return { owner, pm, member, client, company, project, second };
}

describe("projects and tasks", () => {
  it("enforces status transitions and the waiting-on-client request", async () => {
    const { owner, client, project } = await base();
    await expect(changeProjectStatus(client, project.id, "IN_PROGRESS")).rejects.toMatchObject({ status: 403 });
    await changeProjectStatus(owner, project.id, "IN_PROGRESS");
    await expect(changeProjectStatus(owner, project.id, "WAITING_ON_CLIENT", "  ")).rejects.toThrow(/outstanding request/i);
    const waiting = await changeProjectStatus(owner, project.id, "WAITING_ON_CLIENT", "Please send the logo.");
    expect(waiting.status).toBe("WAITING_ON_CLIENT");
    expect(waiting.outstandingRequest).toBe("Please send the logo.");
    await changeProjectStatus(owner, project.id, "COMPLETED");
    await expect(changeProjectStatus(owner, project.id, "CANCELLED")).rejects.toThrow(/Cannot move/i);
  });

  it("rejects cross-project milestone, parent, and dependency links", async () => {
    const { pm, member, project, second } = await base();
    const milestone = await createMilestone(pm, second.id, { title: "Elsewhere" });
    await expect(
      createTask(pm, project.id, { title: "Wrong milestone", milestoneId: milestone.id, clientVisible: true }),
    ).rejects.toThrow(/not on this project/i);
    const local = await createTask(pm, project.id, {
      title: "Local task",
      assigneeId: member.userId,
      clientVisible: true,
    });
    const foreign = await createTask(pm, second.id, { title: "Foreign task" });
    await expect(
      createTask(pm, project.id, { title: "Bad dependency", blockedByTaskId: foreign.id }),
    ).rejects.toThrow(/same project/i);
    await expect(updateTask(member, local.id, { status: "IN_PROGRESS" })).resolves.toMatchObject({ status: "IN_PROGRESS" });
    await expect(createTask(member, project.id, { title: "Not allowed" })).rejects.toMatchObject({ status: 403 });
  });

  it("blocks completion while a prerequisite is open and keeps a status history", async () => {
    const { pm, project } = await base();
    const first = await createTask(pm, project.id, { title: "First" });
    const second = await createTask(pm, project.id, { title: "Second", blockedByTaskId: first.id });
    await expect(updateTask(pm, second.id, { status: "DONE" })).rejects.toThrow(/prerequisite/i);
    await updateTask(pm, first.id, { status: "DONE" });
    await updateTask(pm, second.id, { status: "DONE" });
    const history = await prisma.taskStatusChange.findMany({ where: { taskId: second.id }, orderBy: { createdAt: "asc" } });
    expect(history.map((row) => row.toStatus)).toEqual(["TODO", "DONE"]);
  });

  it("calculates milestone progress in the database", async () => {
    const { pm, project } = await base();
    expect((await progressForProject(project.id)).percent).toBe(0);
    const empty = await createMilestone(pm, project.id, { title: "Empty" });
    expect((await progressForProject(project.id)).percent).toBe(0);
    const done = await createMilestone(pm, project.id, { title: "Done" });
    await createTask(pm, project.id, { title: "Finished", milestoneId: done.id, status: "DONE" });
    const open = await createMilestone(pm, project.id, { title: "Open" });
    const parent = await createTask(pm, project.id, { title: "Parent done", milestoneId: open.id, status: "DONE" });
    await createTask(pm, project.id, { title: "Child open", milestoneId: open.id, parentTaskId: parent.id, status: "TODO" });
    const progress = await progressForProject(project.id);
    expect(progress.milestonesTotal).toBe(3);
    expect(progress.milestonesCompleted).toBe(1);
    expect(progress.percent).toBe(33);
    expect(empty.id).toBeTruthy();
  });

  it("paginates and filters projects and tasks", async () => {
    const owner = await createActor({ role: "AGENCY_OWNER" });
    const company = await createCompany(owner.organizationId);
    for (let index = 0; index < 25; index += 1) {
      await createProject(owner, {
        name: index % 2 === 0 ? `Alpha ${index}` : `Beta ${index}`,
        reference: `P-${index}`,
        clientCompanyId: company.id,
        priority: "MEDIUM",
        projectManagerId: owner.userId,
      });
    }
    const page = await listProjects(owner, { page: 2, pageSize: 20 });
    expect(page.total).toBe(25);
    expect(page.items).toHaveLength(5);
    const filtered = await listProjects(owner, { page: 1, pageSize: 20, q: "alpha", status: "PLANNING" });
    expect(filtered.total).toBe(13);
    const project = filtered.items[0];
    await createTask(owner, project.id, { title: "Visible task", clientVisible: true, priority: "HIGH" });
    await createTask(owner, project.id, { title: "Hidden task", clientVisible: false, priority: "LOW" });
    const tasks = await listTasks(owner, project.id, { page: 1, pageSize: 20, q: "visible", clientVisible: "true" });
    expect(tasks.total).toBe(1);
    expect(tasks.items[0]?.title).toBe("Visible task");
  });
});
