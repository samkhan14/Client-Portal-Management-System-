import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import type { OrgRole } from "@prisma/client";

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      memberships: {
        where: { revokedAt: null },
        include: { organization: true },
      },
    },
  });
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !passwordOk) return { ok: false as const, reason: "invalid" as const };
  const membership =
    user.memberships.find((item) => item.role !== "PLATFORM_ADMIN") ?? user.memberships[0] ?? null;
  if (!membership) return { ok: false as const, reason: "no-access" as const };
  return { ok: true as const, user, membership, role: membership.role as OrgRole };
}
