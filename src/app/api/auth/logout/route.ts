import { NextResponse } from "next/server";
import { actorFromRequest, assertSameOrigin, revokeSession, SESSION_COOKIE } from "@/lib/auth/session";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await actorFromRequest(request);
    if (actor) {
      const csrf = request.headers.get("x-csrf-token");
      if (csrf !== actor.csrfToken) {
        return NextResponse.json({ error: "Blocked request." }, { status: 403 });
      }
      await revokeSession(actor.sessionId);
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
