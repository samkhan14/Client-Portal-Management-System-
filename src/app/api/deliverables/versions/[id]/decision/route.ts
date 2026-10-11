import { NextResponse } from "next/server";
import { z } from "zod";
import { actorFromRequest, assertSameOrigin } from "@/lib/auth/session";
import { errorResponse, notFound } from "@/lib/errors";
import { decideDeliverableVersion } from "@/server/deliverables";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await actorFromRequest(request);
    if (!actor) throw notFound();
    const csrf = request.headers.get("x-csrf-token");
    if (csrf !== actor.csrfToken) {
      return NextResponse.json({ error: "Blocked request." }, { status: 403 });
    }
    const body = await request.json().catch(() => null);
    const parsed = z
      .object({
        decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]),
        feedback: z.string().optional().nullable(),
      })
      .safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Choose approve or request changes." }, { status: 400 });
    }
    const { id } = await context.params;
    await decideDeliverableVersion(actor, id, parsed.data.decision, parsed.data.feedback);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
