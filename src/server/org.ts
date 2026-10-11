import { z, ZodError } from "zod";
import type { OrgRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { canManageAllProjects, canManageOrg, canRevokeRole, isClientRole, projectMemberRoleFor } from "@/lib/authz";
import type { Actor } from "@/lib/auth/types";
import { emailSchema, inviteRoleSchema, passwordSchema } from "@/lib/validators";
import { hashPassword, hashToken, newToken, verifyPassword } from "@/lib/auth/password";
import { recordActivity } from "@/server/activity";
import { processEmailNotifications, queueNotification } from "@/server/notifications";
const CLIENT_ROLES = new Set<OrgRole>(["CLIENT_ADMIN", "CLIENT_COLLABORATOR", "READ_ONLY"]);

export async function updateOrganization(
  actor: Actor,
  input: { name?: string; emailNotificationsEnabled?: boolean; deadlineReminderDays?: number },
) {
  if (!canManageOrg(actor.role)) throw forbidden();
  const name = input.name?.trim();
  if (name !== undefined && (name.length < 2 || name.length > 160)) {
    throw new AppError("VALIDATION", "Enter an organization name.");
  }
  const days = input.deadlineReminderDays;
  if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > 30)) {
    throw new AppError("VALIDATION", "Reminder window must be between 1 and 30 days.");
  }
  return prisma.organization.update({
    where: { id: actor.organizationId },
    data: {
      name: name || undefined,
      emailNotificationsEnabled: input.emailNotificationsEnabled,
      deadlineReminderDays: days,
    },
  });
}

export async function listClientCompanies(actor: Actor) {
  if (isClientRole(actor.role)) {
    if (!actor.clientCompanyId) return [];
    return prisma.clientCompany.findMany({
      where: { id: actor.clientCompanyId, organizationId: actor.organizationId },
      select: { id: true, name: true, website: true, createdAt: true },
    });
  }
  if (!canManageAllProjects(actor.role) && actor.role !== "TEAM_MEMBER") throw forbidden();
  return prisma.clientCompany.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: true, memberships: true } } },
  });
}

export async function createClientCompany(
  actor: Actor,
  input: { name: string; website?: string | null; notes?: string | null },
) {
  if (!canManageAllProjects(actor.role)) throw forbidden();
  const name = input.name.trim();
  if (name.length < 2) throw new AppError("VALIDATION", "Enter a client company name.");
  return prisma.$transaction(async (tx) => {
    const company = await tx.clientCompany.create({
      data: {
        organizationId: actor.organizationId,
        name,
        website: empty(input.website),
        notes: empty(input.notes),
      },
    });
    const defaults = [
      ["Confirm the main contact", "Name the person who can approve deliverables."],
      ["Share access and assets", "Send the files the team needs to start."],
      ["Confirm scope", "Review the written scope before work begins."],
      ["Confirm billing contact", "Tell the team who should receive invoices."],
    ];
    await tx.clientOnboardingStep.createMany({
      data: defaults.map(([title, description], index) => ({
        clientCompanyId: company.id,
        title,
        description,
        sortOrder: index + 1,
      })),
    });
    return company;
  });
}

export async function getClientCompany(actor: Actor, clientCompanyId: string) {
  if (isClientRole(actor.role) && actor.clientCompanyId !== clientCompanyId) throw notFound();
  const company = await prisma.clientCompany.findFirst({
    where: { id: clientCompanyId, organizationId: actor.organizationId },
    include: {
      steps: { orderBy: { sortOrder: "asc" } },
      memberships: {
        where: { revokedAt: null },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      projects: {
        where: isClientRole(actor.role)
          ? actor.role === "CLIENT_ADMIN"
            ? {}
            : { members: { some: { userId: actor.userId } } }
          : {},
        select: { id: true, name: true, reference: true, status: true },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!company) throw notFound();
  if (isClientRole(actor.role)) {
    return { ...company, notes: null };
  }
  return company;
}

export async function setOnboardingStep(actor: Actor, stepId: string, completed: boolean) {
  const step = await prisma.clientOnboardingStep.findFirst({
    where: { id: stepId, clientCompany: { organizationId: actor.organizationId } },
    include: { clientCompany: true },
  });
  if (!step) throw notFound();
  const allowed =
    canManageAllProjects(actor.role) ||
    (actor.role === "CLIENT_ADMIN" && actor.clientCompanyId === step.clientCompanyId);
  if (!allowed) throw forbidden();
  return prisma.clientOnboardingStep.update({
    where: { id: step.id },
    data: completed
      ? { completedAt: new Date(), completedById: actor.userId }
      : { completedAt: null, completedById: null },
  });
}

export async function listMemberships(actor: Actor) {
  if (!canManageAllProjects(actor.role) && actor.role !== "TEAM_MEMBER") throw forbidden();
  return prisma.membership.findMany({
    where: { organizationId: actor.organizationId, revokedAt: null, role: { not: "PLATFORM_ADMIN" } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      clientCompany: { select: { id: true, name: true } },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
}

export async function revokeMembership(actor: Actor, membershipId: string) {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId: actor.organizationId },
  });
  if (!membership || membership.revokedAt) throw notFound();
  if (!canRevokeRole(actor.role, membership.role)) throw forbidden();
  if (membership.userId === actor.userId) {
    throw new AppError("FORBIDDEN", "You cannot remove your own access.", 403);
  }
  if (membership.role === "AGENCY_OWNER") {
    const owners = await prisma.membership.count({
      where: { organizationId: actor.organizationId, role: "AGENCY_OWNER", revokedAt: null },
    });
    if (owners <= 1) throw new AppError("FORBIDDEN", "The organization needs at least one owner.", 403);
  }
  await prisma.$transaction(async (tx) => {
    await tx.membership.update({ where: { id: membership.id }, data: { revokedAt: new Date() } });
    await tx.session.updateMany({
      where: { userId: membership.userId, activeOrganizationId: actor.organizationId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await recordActivity(tx, {
      organizationId: actor.organizationId,
      actorId: actor.userId,
      type: "MEMBERSHIP_CHANGED",
      clientVisible: false,
      summary: "A person's access to the organization was removed.",
      entityType: "membership",
      entityId: membership.id,
    });
  });
}

const inviteSchema = z.object({
  email: emailSchema,
  role: inviteRoleSchema,
  clientCompanyId: z.string().optional().nullable(),
  projectIds: z.array(z.string()).optional(),
});

export async function createInvitation(actor: Actor, input: unknown) {
  const data = inviteSchema.parse(input);
  if (actor.role !== "AGENCY_OWNER" && actor.role !== "PROJECT_MANAGER") {
    throw new AppError("INVITE", "Unable to create that invitation.");
  }
  const requestedRole = data.role as string;
  if (actor.role === "PROJECT_MANAGER" && (requestedRole === "AGENCY_OWNER" || requestedRole === "PLATFORM_ADMIN")) {
    throw new AppError("INVITE", "Unable to create that invitation.");
  }
  if (requestedRole === "PLATFORM_ADMIN") throw new AppError("INVITE", "Unable to create that invitation.");
  let clientCompanyId: string | null = null;
  if (CLIENT_ROLES.has(data.role)) {
    if (!data.clientCompanyId) throw new AppError("INVITE", "Unable to create that invitation.");
    const company = await prisma.clientCompany.findFirst({
      where: { id: data.clientCompanyId, organizationId: actor.organizationId },
    });
    if (!company) throw new AppError("INVITE", "Unable to create that invitation.");
    clientCompanyId = company.id;
  } else if (data.clientCompanyId) {
    throw new AppError("INVITE", "Unable to create that invitation.");
  }

  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    const membership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: existingUser.id, organizationId: actor.organizationId } },
    });
    if (membership && !membership.revokedAt) {
      throw new AppError("INVITE", "Unable to create that invitation.");
    }
  }

  const projectIds = [...new Set(data.projectIds ?? [])];
  const token = newToken();
  const invitation = await prisma.$transaction(async (tx) => {
    if (projectIds.length) {
      const projects = await tx.project.findMany({
        where: {
          id: { in: projectIds },
          organizationId: actor.organizationId,
          ...(clientCompanyId ? { clientCompanyId } : {}),
        },
      });
      if (projects.length !== projectIds.length) {
        throw new AppError("INVITE", "Unable to create that invitation.");
      }
    }
    await tx.invitation.updateMany({
      where: { organizationId: actor.organizationId, email: data.email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const created = await tx.invitation.create({
      data: {
        organizationId: actor.organizationId,
        email: data.email,
        role: data.role,
        clientCompanyId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdById: actor.userId,
        projects: projectIds.length
          ? { create: projectIds.map((projectId) => ({ projectId })) }
          : undefined,
      },
    });
    await recordActivity(tx, {
      organizationId: actor.organizationId,
      actorId: actor.userId,
      type: "INVITATION_CREATED",
      clientVisible: false,
      summary: "An invitation was created.",
      entityType: "invitation",
      entityId: created.id,
    });
    if (existingUser) {
      await queueNotification(tx, {
        organizationId: actor.organizationId,
        userId: existingUser.id,
        recipientRole: data.role,
        type: "invitation.created",
        title: `Invitation to ${actor.organizationName}`,
        body: "You have an invitation. Use the link from your administrator to accept it.",
        clientSafe: true,
        dedupeKey: `invite:${created.id}:${existingUser.id}`,
        linkPath: "/login",
      });
    }
    return created;
  });
  await processEmailNotifications();
  return { invitationId: invitation.id, token, expiresAt: invitation.expiresAt };
}

export async function revokeInvitation(actor: Actor, invitationId: string) {
  if (actor.role !== "AGENCY_OWNER" && actor.role !== "PROJECT_MANAGER") throw forbidden();
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, organizationId: actor.organizationId, acceptedAt: null, revokedAt: null },
  });
  if (!invitation) throw notFound();
  if (actor.role === "PROJECT_MANAGER" && invitation.role === "AGENCY_OWNER") throw forbidden();
  await prisma.invitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
}

export async function listInvitations(actor: Actor) {
  if (actor.role !== "AGENCY_OWNER" && actor.role !== "PROJECT_MANAGER") throw forbidden();
  return prisma.invitation.findMany({
    where: { organizationId: actor.organizationId, acceptedAt: null, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      createdAt: true,
      clientCompany: { select: { name: true } },
    },
  });
}

export async function previewInvitation(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organization: { select: { name: true } }, clientCompany: { select: { name: true } } },
  });
  if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt.getTime() < Date.now()) {
    return null;
  }
  const existing = await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
  return {
    email: invitation.email,
    organizationName: invitation.organization.name,
    clientCompanyName: invitation.clientCompany?.name ?? null,
    role: invitation.role,
    hasAccount: Boolean(existing),
  };
}

export async function acceptInvitation(input: {
  token: string;
  name?: string | null;
  password: string;
}) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(input.token) },
    include: { projects: true },
  });
  if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt.getTime() < Date.now()) {
    throw new AppError("INVITE", "This invitation is invalid or has expired.");
  }
  const user = await prisma.$transaction(async (tx) => {
    const claimed = await tx.invitation.updateMany({
      where: {
        id: invitation.id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { acceptedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new AppError("INVITE", "This invitation is invalid or has expired.");
    }
    let account = await tx.user.findUnique({ where: { email: invitation.email } });
    if (!account) {
      let name = "";
      let passwordHash = "";
      try {
        name = z.string().trim().min(2, "Enter your name.").max(120).parse(input.name ?? "");
        passwordHash = await hashPassword(passwordSchema.parse(input.password));
      } catch (error) {
        if (error instanceof ZodError) {
          throw new AppError("VALIDATION", error.issues[0]?.message ?? "Check the form and try again.");
        }
        throw error;
      }
      account = await tx.user.create({
        data: { email: invitation.email, name, passwordHash },
      });
    } else {
      const matches = await verifyPassword(input.password, account.passwordHash);
      if (!matches) throw new AppError("INVITE", "Check the password and try again.");
    }
    const membership = await tx.membership.findUnique({
      where: { userId_organizationId: { userId: account.id, organizationId: invitation.organizationId } },
    });
    if (membership) {
      await tx.membership.update({
        where: { id: membership.id },
        data: {
          role: invitation.role,
          clientCompanyId: invitation.clientCompanyId,
          revokedAt: null,
        },
      });
    } else {
      await tx.membership.create({
        data: {
          userId: account.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
          clientCompanyId: invitation.clientCompanyId,
        },
      });
    }
    const projectRole = projectMemberRoleFor(invitation.role);
    if (projectRole) {
      for (const link of invitation.projects) {
        await tx.projectMember.upsert({
          where: { projectId_userId: { projectId: link.projectId, userId: account.id } },
          create: { projectId: link.projectId, userId: account.id, role: projectRole },
          update: { role: projectRole },
        });
      }
    }
    return account;
  });
  return { userId: user.id, organizationId: invitation.organizationId };
}

export async function listOrganizationsForPlatformAdmin(actor: Actor) {
  if (!actor.isPlatformAdmin) throw forbidden();
  return prisma.organization.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      _count: { select: { projects: true, memberships: true, clientCompanies: true } },
    },
  });
}

function empty(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}
