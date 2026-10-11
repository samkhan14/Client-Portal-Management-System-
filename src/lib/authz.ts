import type { OrgRole, ProjectStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { PROJECT_TRANSITIONS } from "@/lib/constants";
import type { Actor } from "@/lib/auth/types";

const CLIENT_ROLES = new Set<OrgRole>(["CLIENT_ADMIN", "CLIENT_COLLABORATOR", "READ_ONLY"]);
const INTERNAL_ROLES = new Set<OrgRole>(["AGENCY_OWNER", "PROJECT_MANAGER", "TEAM_MEMBER"]);

export function isClientRole(role: OrgRole): boolean {
  return CLIENT_ROLES.has(role);
}

export function isInternalRole(role: OrgRole): boolean {
  return INTERNAL_ROLES.has(role);
}

export function homeFor(role: OrgRole): string {
  if (role === "PLATFORM_ADMIN") return "/admin";
  if (isClientRole(role)) return "/portal";
  return "/dashboard";
}

/**
 * Visibility rules (also documented in the README):
 * - Agency owner and project manager see every project in the organization.
 * - Team members see only projects they are members of.
 * - Client admins see every project for their client company.
 * - Collaborators and read-only stakeholders see only projects they are members of,
 *   and only inside their own client company.
 * - Platform admins do not receive project access through this filter.
 */
export function projectVisibilityWhere(actor: Actor): Prisma.ProjectWhereInput {
  if (actor.role === "AGENCY_OWNER" || actor.role === "PROJECT_MANAGER") {
    return { organizationId: actor.organizationId };
  }
  if (actor.role === "TEAM_MEMBER") {
    return {
      organizationId: actor.organizationId,
      members: { some: { userId: actor.userId } },
    };
  }
  if (actor.role === "CLIENT_ADMIN" && actor.clientCompanyId) {
    return {
      organizationId: actor.organizationId,
      clientCompanyId: actor.clientCompanyId,
    };
  }
  if (
    (actor.role === "CLIENT_COLLABORATOR" || actor.role === "READ_ONLY") &&
    actor.clientCompanyId
  ) {
    return {
      organizationId: actor.organizationId,
      clientCompanyId: actor.clientCompanyId,
      members: { some: { userId: actor.userId } },
    };
  }
  return { id: "__no_project_access__" };
}

export function canManageOrg(role: OrgRole): boolean {
  return role === "AGENCY_OWNER";
}

export function canManageAllProjects(role: OrgRole): boolean {
  return role === "AGENCY_OWNER" || role === "PROJECT_MANAGER";
}

export function canChangeProjectStatus(role: OrgRole): boolean {
  return role === "AGENCY_OWNER" || role === "PROJECT_MANAGER";
}

export function canSeeInternalFinancials(role: OrgRole): boolean {
  return role === "AGENCY_OWNER" || role === "PROJECT_MANAGER";
}

export function canSeeTaskEstimates(role: OrgRole): boolean {
  return isInternalRole(role);
}

export function canApproveDeliverables(role: OrgRole): boolean {
  return role === "CLIENT_ADMIN";
}

export function canDraftDeliverables(role: OrgRole): boolean {
  return role === "AGENCY_OWNER" || role === "PROJECT_MANAGER";
}

export function canComment(role: OrgRole): boolean {
  return role !== "READ_ONLY" && role !== "PLATFORM_ADMIN";
}

export function canUpload(role: OrgRole): boolean {
  return isInternalRole(role);
}

export function canLogTime(role: OrgRole): boolean {
  return isInternalRole(role);
}

export function canInviteRole(actorRole: OrgRole, target: OrgRole): boolean {
  if (target === "PLATFORM_ADMIN") return false;
  if (actorRole === "AGENCY_OWNER") return true;
  if (actorRole === "PROJECT_MANAGER") return target !== "AGENCY_OWNER";
  return false;
}

export function canRevokeRole(actorRole: OrgRole, target: OrgRole): boolean {
  if (target === "PLATFORM_ADMIN") return false;
  if (actorRole === "AGENCY_OWNER") return true;
  if (actorRole === "PROJECT_MANAGER") {
    return target === "PROJECT_MANAGER" || target === "TEAM_MEMBER" || CLIENT_ROLES.has(target);
  }
  return false;
}

export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  return PROJECT_TRANSITIONS[from].includes(to);
}

export function projectMemberRoleFor(role: OrgRole):
  | "PROJECT_MANAGER"
  | "TEAM_MEMBER"
  | "CLIENT_ADMIN"
  | "CLIENT_COLLABORATOR"
  | "READ_ONLY"
  | null {
  if (role === "AGENCY_OWNER" || role === "PROJECT_MANAGER") return "PROJECT_MANAGER";
  if (role === "TEAM_MEMBER") return "TEAM_MEMBER";
  if (role === "CLIENT_ADMIN") return "CLIENT_ADMIN";
  if (role === "CLIENT_COLLABORATOR") return "CLIENT_COLLABORATOR";
  if (role === "READ_ONLY") return "READ_ONLY";
  return null;
}
