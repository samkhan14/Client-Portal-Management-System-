import { actorFromRequest } from "@/lib/auth/session";
import { errorResponse, notFound } from "@/lib/errors";
import { readFileForActor } from "@/server/files";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await actorFromRequest(request);
    if (!actor) throw notFound();
    const { id } = await context.params;
    const { file, bytes } = await readFileForActor(actor, id);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="${file.originalName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
