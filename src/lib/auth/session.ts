import type { OrgRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashToken, newToken } from "@/lib/auth/password";
import type { Actor } from "@/lib/auth/types";
import { AppError } from "@/lib/errors";

export const SESSION_COOKIE = "cp_session";
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;

export function sessionCookieOptions(maxAgeSeconds = SESSION_MS / 1000) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

function pickMembership<T extends { role: OrgRole }>(memberships: T[]): T | null {
  return memberships.find((membership) => membership.role !== "PLATFORM_ADMIN") ?? memberships[0] ?? null;
}

export async function actorFromToken(token: string | null | undefined): Promise<Actor | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          memberships: {
            where: { revokedAt: null },
            include: { organization: true },
          },
        },
      },
    },
  });
  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) return null;
  const memberships = session.user.memberships;
  const active =
    memberships.find((membership) => membership.organizationId === session.activeOrganizationId) ??
    pickMembership(memberships);
  if (!active) return null;
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    organizationId: active.organizationId,
    organizationName: active.organization.name,
    role: active.role,
    clientCompanyId: active.clientCompanyId,
    membershipId: active.id,
    csrfToken: session.csrfToken,
    sessionId: session.id,
    isPlatformAdmin: memberships.some((membership) => membership.role === "PLATFORM_ADMIN"),
  };
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function actorFromRequest(request: Request): Promise<Actor | null> {
  return actorFromToken(readCookie(request, SESSION_COOKIE));
}

export async function createSession(userId: string, organizationId: string, userAgent?: string | null) {
  const token = newToken();
  const csrfToken = newToken();
  const session = await prisma.session.create({
    data: {
      userId,
      activeOrganizationId: organizationId,
      tokenHash: hashToken(token),
      csrfToken,
      expiresAt: new Date(Date.now() + SESSION_MS),
      userAgent: userAgent?.slice(0, 300) ?? null,
    },
  });
  return { token, csrfToken, sessionId: session.id };
}

export function assertSameOrigin(request: Request) {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  if (!host || !origin) {
    throw new AppError("CSRF", "Blocked a request without an origin.", 403);
  }
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("CSRF", "Blocked a request with a bad origin.", 403);
  }
  if (originHost !== host) {
    throw new AppError("CSRF", "Blocked a cross-site request.", 403);
  }
}

export async function revokeSession(sessionId: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}
