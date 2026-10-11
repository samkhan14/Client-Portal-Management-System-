import { NextResponse } from "next/server";
import { actorFromRequest } from "@/lib/auth/session";
import { isClientRole } from "@/lib/authz";
import { errorResponse, notFound } from "@/lib/errors";
import { moneyToString } from "@/lib/format";
import { progressForProject } from "@/lib/progress";
import { presentProject, requireProject } from "@/server/projects";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await actorFromRequest(request);
    if (!actor) throw notFound();
    const { id } = await context.params;
    const project = presentProject(await requireProject(actor, id), actor);
    const progress = await progressForProject(project.id);
    const client = isClientRole(actor.role);
    return NextResponse.json({
      id: project.id,
      name: project.name,
      reference: project.reference,
      description: project.description,
      scope: project.scope,
      status: project.status,
      priority: project.priority,
      startDate: project.startDate,
      dueDate: project.dueDate,
      outstandingRequest: project.outstandingRequest,
      agreedFee: moneyToString(project.agreedFee),
      internalEstimate: client || actor.role === "TEAM_MEMBER" ? null : moneyToString(project.internalEstimate),
      internalNotes: client ? null : project.internalNotes,
      progress,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
