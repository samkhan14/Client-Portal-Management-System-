import type { OrgRole } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import type { Actor } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";

let seq = 0;

export async function createOrg(name = "Northline") {
  seq += 1;
  return prisma.organization.create({
    data: { name, slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${seq}` },
  });
}

export async function createUser(email: string, name = email.split("@")[0]) {
  return prisma.user.create({
    data: { email, name, passwordHash: await hashPassword("Password123!", 4) },
  });
}

export async function createActor(input: {
  orgId?: string;
  orgName?: string;
  role: OrgRole;
  email?: string;
  clientCompanyId?: string | null;
}): Promise<Actor> {
  seq += 1;
  const org = input.orgId
    ? await prisma.organization.findUniqueOrThrow({ where: { id: input.orgId } })
    : await createOrg(input.orgName ?? "Northline");
  const email = input.email ?? `${input.role.toLowerCase()}.${seq}@example.test`;
  const user = await createUser(email, email.split("@")[0]);
  const membership = await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      role: input.role,
      clientCompanyId: input.clientCompanyId ?? null,
    },
  });
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    organizationId: org.id,
    organizationName: org.name,
    role: input.role,
    clientCompanyId: input.clientCompanyId ?? null,
    membershipId: membership.id,
    csrfToken: "csrf-test-token",
    sessionId: "unused",
    isPlatformAdmin: input.role === "PLATFORM_ADMIN",
  };
}

export async function createCompany(orgId: string, name = "Acme") {
  return prisma.clientCompany.create({ data: { organizationId: orgId, name } });
}

export async function sessionCookie(actor: Actor) {
  const session = await createSession(actor.userId, actor.organizationId);
  await prisma.session.update({ where: { id: session.sessionId }, data: { csrfToken: actor.csrfToken } });
  actor.sessionId = session.sessionId;
  return `${SESSION_COOKIE}=${encodeURIComponent(session.token)}`;
}

export function requestFor(path: string, cookie: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", cookie);
  headers.set("host", "localhost:3000");
  headers.set("origin", "http://localhost:3000");
  if (!headers.has("x-csrf-token")) headers.set("x-csrf-token", "csrf-test-token");
  return new Request(`http://localhost:3000${path}`, { ...init, headers });
}
