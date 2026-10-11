import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { errorResponse } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { acceptInvitation } from "@/server/org";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json().catch(() => null);
    const parsed = z
      .object({
        token: z.string().min(10).max(200),
        name: z.string().optional().nullable(),
        password: z.string().min(1).max(200),
      })
      .safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "This invitation is invalid or has expired." }, { status: 400 });
    }
    const accepted = await acceptInvitation(parsed.data);
    const membership = await prisma.membership.findFirst({
      where: { userId: accepted.userId, organizationId: accepted.organizationId, revokedAt: null },
    });
    const session = await createSession(accepted.userId, accepted.organizationId, request.headers.get("user-agent"));
    const redirectTo = membership?.role === "CLIENT_ADMIN" || membership?.role === "CLIENT_COLLABORATOR" || membership?.role === "READ_ONLY"
      ? "/portal"
      : membership?.role === "PLATFORM_ADMIN"
        ? "/admin"
        : "/dashboard";
    const response = NextResponse.json({ ok: true, redirectTo });
    response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions());
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
