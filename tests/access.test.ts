import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { addComment, listActivity, listComments } from "@/server/comments";
import { readFileForActor, uploadProjectFile } from "@/server/files";
import { listInvoices } from "@/server/finance";
import { createProject, presentProject, requireProject } from "@/server/projects";
import { createActor, createCompany } from "./helpers";

async function workspace() {
  const owner = await createActor({ role: "AGENCY_OWNER", orgName: "Northline" });
  const outsider = await createActor({ role: "AGENCY_OWNER", orgName: "Harbor" });
  const member = await createActor({ role: "TEAM_MEMBER", orgId: owner.organizationId, email: "member@northline.test" });
  const acme = await createCompany(owner.organizationId, "Acme");
  const globex = await createCompany(owner.organizationId, "Globex");
  const acmeAdmin = await createActor({
    role: "CLIENT_ADMIN",
    orgId: owner.organizationId,
    clientCompanyId: acme.id,
    email: "ada@acme.test",
  });
  const globexAdmin = await createActor({
    role: "CLIENT_ADMIN",
    orgId: owner.organizationId,
    clientCompanyId: globex.id,
    email: "gina@globex.test",
  });
  const collaborator = await createActor({
    role: "CLIENT_COLLABORATOR",
    orgId: owner.organizationId,
    clientCompanyId: acme.id,
    email: "cole@acme.test",
  });
  const reader = await createActor({
    role: "READ_ONLY",
    orgId: owner.organizationId,
    clientCompanyId: acme.id,
    email: "rory@acme.test",
  });
  const project = await createProject(owner, {
    name: "Website",
    reference: "WEB-1",
    clientCompanyId: acme.id,
    priority: "HIGH",
    projectManagerId: owner.userId,
    memberIds: [member.userId, acmeAdmin.userId, collaborator.userId, reader.userId],
    agreedFee: "18000.00",
    agreedFeeClientVisible: true,
    internalEstimate: "9000.00",
    internalNotes: "Secret margin note",
  });
  return { owner, outsider, member, acme, globex, acmeAdmin, globexAdmin, collaborator, reader, project };
}

describe("tenancy and visibility", () => {
  it("denies cross-organization project access", async () => {
    const { outsider, project } = await workspace();
    await expect(requireProject(outsider, project.id)).rejects.toMatchObject({ status: 404 });
  });

  it("isolates client companies and limits collaborator membership", async () => {
    const { owner, globex, globexAdmin, acmeAdmin, collaborator, project } = await workspace();
    await expect(requireProject(globexAdmin, project.id)).rejects.toMatchObject({ status: 404 });
    const other = await createProject(owner, {
      name: "Audit",
      reference: "GLO-1",
      clientCompanyId: globex.id,
      priority: "LOW",
      projectManagerId: owner.userId,
      memberIds: [globexAdmin.userId],
    });
    await expect(requireProject(acmeAdmin, other.id)).rejects.toMatchObject({ status: 404 });
    await expect(requireProject(acmeAdmin, project.id)).resolves.toMatchObject({ id: project.id });
    await expect(requireProject(collaborator, project.id)).resolves.toMatchObject({ id: project.id });
    await expect(requireProject(collaborator, other.id)).rejects.toMatchObject({ status: 404 });
  });

  it("hides internal notes, estimates, comments, and files from clients", async () => {
    const { owner, member, acmeAdmin, reader, project } = await workspace();
    const view = presentProject(await requireProject(acmeAdmin, project.id), acmeAdmin);
    expect(view.internalNotes).toBeNull();
    expect(view.internalEstimate).toBeNull();
    expect(view.agreedFee?.toString()).toBe("18000");
    const staff = presentProject(await requireProject(member, project.id), member);
    expect(staff.internalEstimate).toBeNull();
    expect(staff.internalNotes).toContain("Secret");

    await addComment(owner, { projectId: project.id, body: "Client can read this.", clientVisible: true });
    await addComment(owner, { projectId: project.id, body: "Staff-only staffing plan.", clientVisible: false });
    const clientComments = await listComments(acmeAdmin, project.id);
    expect(clientComments.map((comment) => comment.body)).toEqual(["Client can read this."]);
    const clientActivity = await listActivity(acmeAdmin, project.id);
    expect(clientActivity.some((event) => event.summary.includes("staffing"))).toBe(false);
    expect(JSON.stringify(clientActivity)).not.toContain("Staff-only staffing plan.");

    await uploadProjectFile(owner, {
      projectId: project.id,
      originalName: "secret.txt",
      mimeType: "text/plain",
      bytes: Buffer.from("internal only\n"),
      clientVisible: false,
    });
    const hidden = await prisma.fileAsset.findFirstOrThrow({ where: { projectId: project.id, clientVisible: false } });
    await expect(readFileForActor(acmeAdmin, hidden.id)).rejects.toMatchObject({ status: 404 });
    const visible = await uploadProjectFile(owner, {
      projectId: project.id,
      originalName: "brief.txt",
      mimeType: "text/plain",
      bytes: Buffer.from("shared brief\n"),
      clientVisible: true,
    });
    const downloaded = await readFileForActor(acmeAdmin, visible.id);
    expect(downloaded.bytes.toString()).toContain("shared brief");
    await expect(addComment(reader, { projectId: project.id, body: "nope", clientVisible: true })).rejects.toMatchObject({ status: 403 });
    await expect(listInvoices(acmeAdmin, project.id)).resolves.toEqual([]);
  });
});
