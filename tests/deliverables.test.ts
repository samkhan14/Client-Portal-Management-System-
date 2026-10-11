import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createDeliverable, createNextVersion, decideDeliverableVersion, submitDeliverableVersion } from "@/server/deliverables";
import { createProject } from "@/server/projects";
import { createActor, createCompany } from "./helpers";

async function reviewSetup() {
  const owner = await createActor({ role: "AGENCY_OWNER" });
  const member = await createActor({ role: "TEAM_MEMBER", orgId: owner.organizationId, email: "member@northline.test" });
  const company = await createCompany(owner.organizationId);
  const admin = await createActor({
    role: "CLIENT_ADMIN",
    orgId: owner.organizationId,
    clientCompanyId: company.id,
    email: "ada@acme.test",
  });
  const collaborator = await createActor({
    role: "CLIENT_COLLABORATOR",
    orgId: owner.organizationId,
    clientCompanyId: company.id,
    email: "cole@acme.test",
  });
  const project = await createProject(owner, {
    name: "Website",
    reference: "WEB-2",
    clientCompanyId: company.id,
    priority: "MEDIUM",
    projectManagerId: owner.userId,
    memberIds: [member.userId, admin.userId, collaborator.userId],
  });
  const created = await createDeliverable(owner, project.id, {
    title: "Homepage concepts",
    externalLink: "https://example.com/concepts",
  });
  return { owner, member, admin, collaborator, project, version: created.version, deliverable: created.deliverable };
}

describe("deliverable approvals", () => {
  it("submits, approves once, and keeps that approval when a new version starts", async () => {
    const { owner, member, admin, collaborator, version, deliverable } = await reviewSetup();
    await expect(submitDeliverableVersion(member, version.id)).rejects.toMatchObject({ status: 403 });
    await submitDeliverableVersion(owner, version.id);
    await expect(decideDeliverableVersion(collaborator, version.id, "APPROVED", "ok")).rejects.toMatchObject({ status: 403 });
    await decideDeliverableVersion(admin, version.id, "APPROVED", "Approved as submitted.");
    await expect(decideDeliverableVersion(admin, version.id, "APPROVED", "Again")).rejects.toMatchObject({ status: 409 });
    const approved = await prisma.deliverableVersion.findUniqueOrThrow({ where: { id: version.id } });
    expect(approved.status).toBe("APPROVED");
    expect(approved.reviewerId).toBe(admin.userId);
    const next = await createNextVersion(owner, deliverable.id, "Follow-up");
    expect(next.versionNumber).toBe(2);
    expect(next.status).toBe("DRAFT");
    const preserved = await prisma.deliverableVersion.findUniqueOrThrow({ where: { id: version.id } });
    expect(preserved.status).toBe("APPROVED");
    expect(preserved.feedback).toBe("Approved as submitted.");
  });

  it("rejects a second concurrent decision", async () => {
    const { owner, admin, version } = await reviewSetup();
    await submitDeliverableVersion(owner, version.id);
    const results = await Promise.allSettled([
      decideDeliverableVersion(admin, version.id, "APPROVED", "Yes"),
      decideDeliverableVersion(admin, version.id, "CHANGES_REQUESTED", "Please revise the header."),
    ]);
    const rejected = results.filter((result) => result.status === "rejected");
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
    const stored = await prisma.deliverableVersion.findUniqueOrThrow({ where: { id: version.id } });
    expect(["APPROVED", "CHANGES_REQUESTED"]).toContain(stored.status);
    expect(stored.decidedAt).not.toBeNull();
  });

  it("records a change request without overwriting the submitted version", async () => {
    const { owner, admin, version, deliverable } = await reviewSetup();
    await submitDeliverableVersion(owner, version.id);
    await decideDeliverableVersion(admin, version.id, "CHANGES_REQUESTED", "Use the darker green.");
    const next = await createNextVersion(owner, deliverable.id);
    await prisma.deliverableVersion.update({
      where: { id: next.id },
      data: { externalLink: "https://example.com/v2" },
    });
    await submitDeliverableVersion(owner, next.id);
    const versions = await prisma.deliverableVersion.findMany({
      where: { deliverableId: deliverable.id },
      orderBy: { versionNumber: "asc" },
    });
    expect(versions.map((item) => item.status)).toEqual(["CHANGES_REQUESTED", "SUBMITTED"]);
    expect(versions[0]?.feedback).toBe("Use the darker green.");
  });
});
