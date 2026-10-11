import type { OrgRole } from "@prisma/client";

export type Actor = {
  userId: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: OrgRole;
  clientCompanyId: string | null;
  membershipId: string;
  csrfToken: string;
  sessionId: string;
  isPlatformAdmin: boolean;
};
