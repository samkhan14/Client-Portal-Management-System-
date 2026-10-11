import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { homeFor } from "@/lib/authz";
import { errorResponse } from "@/lib/errors";
import { emailSchema } from "@/lib/validators";
import { authenticate } from "@/server/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json().catch(() => null);
    const parsed = z.object({ email: emailSchema, password: z.string().min(1).max(200) }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    const result = await authenticate(parsed.data.email, parsed.data.password);
    if (!result.ok) {
      const message = result.reason === "no-access" ? "This account does not have access." : "Invalid email or password.";
      return NextResponse.json({ error: message }, { status: 401 });
    }
    const session = await createSession(result.user.id, result.membership.organizationId, request.headers.get("user-agent"));
    const response = NextResponse.json({ ok: true, redirectTo: homeFor(result.role) });
    response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions());
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
