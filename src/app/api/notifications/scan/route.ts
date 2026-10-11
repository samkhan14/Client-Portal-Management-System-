import { NextResponse } from "next/server";
import { actorFromRequest, assertSameOrigin } from "@/lib/auth/session";
import { errorResponse, forbidden, notFound } from "@/lib/errors";
import { scanApproachingDeadlines } from "@/server/notifications";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await actorFromRequest(request);
    if (!actor) throw notFound();
    if (request.headers.get("x-csrf-token") !== actor.csrfToken) {
      return NextResponse.json({ error: "Blocked request." }, { status: 403 });
    }
    if (actor.role !== "AGENCY_OWNER" && actor.role !== "PROJECT_MANAGER") throw forbidden();
    const result = await scanApproachingDeadlines(actor.organizationId);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
