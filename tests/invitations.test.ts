import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/auth/password";
import { acceptInvitation, createInvitation, previewInvitation, revokeInvitation } from "@/server/org";
import { requireProject } from "@/server/projects";
import { createActor, createCompany, createUser } from "./helpers";

describe("invitations", () => {
  it("creates, expires, accepts once, and revokes", async () => {
    const owner = await createActor({ role: "AGENCY_OWNER" });
    const company = await createCompany(owner.organizationId, "Acme");
    const created = await createInvitation(owner, {
      email: "new.person@acme.test",
      role: "CLIENT_COLLABORATOR",
      clientCompanyId: company.id,
    });
    expect(created.token).toBeTruthy();
    const stored = await prisma.invitation.findUniqueOrThrow({ where: { id: created.invitationId } });
    expect(stored.tokenHash).toBe(hashToken(created.token));
    expect(stored.tokenHash).not.toContain(created.token);

    const accepted = await acceptInvitation({ token: created.token, name: "New Person", password: "Password123!" });
    const membership = await prisma.membership.findFirstOrThrow({ where: { userId: accepted.userId } });
    expect(membership.role).toBe("CLIENT_COLLABORATOR");
    expect(membership.clientCompanyId).toBe(company.id);
    await expect(acceptInvitation({ token: created.token, name: "New Person", password: "Password123!" })).rejects.toThrow(
      /invalid or has expired/i,
    );

    const second = await createInvitation(owner, {
      email: "later@acme.test",
      role: "READ_ONLY",
      clientCompanyId: company.id,
    });
    await prisma.invitation.update({ where: { id: second.invitationId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await previewInvitation(second.token)).toBeNull();
    await expect(acceptInvitation({ token: second.token, name: "Late", password: "Password123!" })).rejects.toThrow(/invalid or has expired/i);

    const third = await createInvitation(owner, {
      email: "revoke@acme.test",
      role: "TEAM_MEMBER",
    });
    await revokeInvitation(owner, third.invitationId);
    await expect(acceptInvitation({ token: third.token, name: "Nope", password: "Password123!" })).rejects.toThrow(/invalid or has expired/i);
  });

  it("uses one generic error when the email is already a member", async () => {
    const owner = await createActor({ role: "AGENCY_OWNER", email: "owner@northline.test" });
    const company = await createCompany(owner.organizationId);
    await expect(
      createInvitation(owner, { email: owner.email, role: "TEAM_MEMBER" }),
    ).rejects.toThrow("Unable to create that invitation.");
    await expect(
      createInvitation(owner, { email: "missing@acme.test", role: "CLIENT_ADMIN" }),
    ).rejects.toThrow("Unable to create that invitation.");
    const pm = await createActor({ role: "PROJECT_MANAGER", orgId: owner.organizationId });
    await expect(createInvitation(pm, { email: "boss@northline.test", role: "AGENCY_OWNER" })).rejects.toThrow(
      "Unable to create that invitation.",
    );
    expect(company.id).toBeTruthy();
  });

  it("lets an existing user accept with their password and joins the project", async () => {
    const owner = await createActor({ role: "AGENCY_OWNER" });
    const company = await createCompany(owner.organizationId, "Acme");
    const existing = await createUser("known@acme.test", "Known");
    const project = await prisma.project.create({
      data: {
        organizationId: owner.organizationId,
        clientCompanyId: company.id,
        name: "Site",
        reference: "WEB-9",
        createdById: owner.userId,
      },
    });
    const invite = await createInvitation(owner, {
      email: existing.email,
      role: "CLIENT_COLLABORATOR",
      clientCompanyId: company.id,
      projectIds: [project.id],
    });
    await expect(acceptInvitation({ token: invite.token, password: "wrong-password-1" })).rejects.toThrow(/password/i);
    const stillOpen = await prisma.invitation.findUniqueOrThrow({ where: { id: invite.invitationId } });
    expect(stillOpen.acceptedAt).toBeNull();
    await acceptInvitation({ token: invite.token, password: "Password123!" });
    const actor = {
      userId: existing.id,
      email: existing.email,
      name: "Known",
      organizationId: owner.organizationId,
      organizationName: owner.organizationName,
      role: "CLIENT_COLLABORATOR" as const,
      clientCompanyId: company.id,
      membershipId: "x",
      csrfToken: "x",
      sessionId: "x",
      isPlatformAdmin: false,
    };
    await expect(requireProject(actor, project.id)).resolves.toMatchObject({ id: project.id });
  });
});
