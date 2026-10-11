import { describe, expect, it } from "vitest";
import { GET as getFile } from "@/app/api/files/[id]/route";
import { GET as getProject } from "@/app/api/projects/[id]/route";
import { POST as decide } from "@/app/api/deliverables/versions/[id]/decision/route";
import { prisma } from "@/lib/db";
import { createDeliverable, submitDeliverableVersion } from "@/server/deliverables";
import { uploadProjectFile } from "@/server/files";
import { createProject } from "@/server/projects";
import { createActor, createCompany, requestFor, sessionCookie } from "./helpers";

describe("route authorization", () => {
  it("blocks cross-tenant and client downloads and exposes only safe project fields", async () => {
    const owner = await createActor({ role: "AGENCY_OWNER" });
    const outsider = await createActor({ role: "AGENCY_OWNER", orgName: "Harbor" });
    const company = await createCompany(owner.organizationId);
    const client = await createActor({
      role: "CLIENT_ADMIN",
      orgId: owner.organizationId,
      clientCompanyId: company.id,
      email: "ada@acme.test",
    });
    const member = await createActor({ role: "TEAM_MEMBER", orgId: owner.organizationId, email: "member@northline.test" });
    const project = await createProject(owner, {
      name: "Website",
      reference: "WEB-8",
      clientCompanyId: company.id,
      priority: "MEDIUM",
      projectManagerId: owner.userId,
      memberIds: [client.userId, member.userId],
      internalEstimate: "4000.00",
      internalNotes: "Do not leak",
      agreedFee: "9000.00",
      agreedFeeClientVisible: false,
    });
    const secret = await uploadProjectFile(owner, {
      projectId: project.id,
      originalName: "secret.txt",
      mimeType: "text/plain",
      bytes: Buffer.from("staff only\n"),
      clientVisible: false,
    });
    const ownerCookie = await sessionCookie(owner);
    const clientCookie = await sessionCookie(client);
    const outsiderCookie = await sessionCookie(outsider);
    const hidden = await getFile(requestFor(`/api/files/${secret.id}`, clientCookie), { params: Promise.resolve({ id: secret.id }) });
    expect(hidden.status).toBe(404);
    const foreign = await getFile(requestFor(`/api/files/${secret.id}`, outsiderCookie), { params: Promise.resolve({ id: secret.id }) });
    expect(foreign.status).toBe(404);
    const allowed = await getFile(requestFor(`/api/files/${secret.id}`, ownerCookie), { params: Promise.resolve({ id: secret.id }) });
    expect(allowed.status).toBe(200);
    expect(await allowed.text()).toContain("staff only");

    const clientProject = await getProject(requestFor(`/api/projects/${project.id}`, clientCookie), {
      params: Promise.resolve({ id: project.id }),
    });
    expect(clientProject.status).toBe(200);
    const body = await clientProject.json();
    expect(body.internalNotes).toBeNull();
    expect(body.internalEstimate).toBeNull();
    expect(body.agreedFee).toBeNull();
    const outsiderProject = await getProject(requestFor(`/api/projects/${project.id}`, outsiderCookie), {
      params: Promise.resolve({ id: project.id }),
    });
    expect(outsiderProject.status).toBe(404);
  });

  it("approves through the route once and rejects a duplicate or a team member", async () => {
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
      reference: "WEB-9",
      clientCompanyId: company.id,
      priority: "MEDIUM",
      projectManagerId: owner.userId,
      memberIds: [member.userId, client.userId],
    });
    const created = await createDeliverable(owner, project.id, {
      title: "Concepts",
      externalLink: "https://example.com/file",
    });
    await submitDeliverableVersion(owner, created.version.id);
    const memberCookie = await sessionCookie(member);
    const clientCookie = await sessionCookie(client);
    const denied = await decide(
      requestFor(`/api/deliverables/versions/${created.version.id}/decision`, memberCookie, {
        method: "POST",
        body: JSON.stringify({ decision: "APPROVED", feedback: "No" }),
      }),
      { params: Promise.resolve({ id: created.version.id }) },
    );
    expect(denied.status).toBe(403);
    const approved = await decide(
      requestFor(`/api/deliverables/versions/${created.version.id}/decision`, clientCookie, {
        method: "POST",
        body: JSON.stringify({ decision: "APPROVED", feedback: "Ship it" }),
      }),
      { params: Promise.resolve({ id: created.version.id }) },
    );
    expect(approved.status).toBe(200);
    const duplicate = await decide(
      requestFor(`/api/deliverables/versions/${created.version.id}/decision`, clientCookie, {
        method: "POST",
        body: JSON.stringify({ decision: "APPROVED", feedback: "Again" }),
      }),
      { params: Promise.resolve({ id: created.version.id }) },
    );
    expect(duplicate.status).toBe(409);
    const stored = await prisma.deliverableVersion.findUniqueOrThrow({ where: { id: created.version.id } });
    expect(stored.status).toBe("APPROVED");
    expect(stored.feedback).toBe("Ship it");
  });
});
