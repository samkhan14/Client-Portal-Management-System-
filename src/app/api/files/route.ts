import { NextResponse } from "next/server";
import { actorFromRequest, assertSameOrigin } from "@/lib/auth/session";
import { safeReturnTo } from "@/lib/action-state";
import { AppError, errorResponse } from "@/lib/errors";
import { uploadProjectFile } from "@/server/files";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let returnTo = "/projects";
  try {
    assertSameOrigin(request);
    const actor = await actorFromRequest(request);
    if (!actor) return NextResponse.json({ error: "Not found." }, { status: 401 });
    const form = await request.formData();
    returnTo = safeReturnTo(form.get("returnTo"), `/projects/${String(form.get("projectId") ?? "")}/files`);
    if (String(form.get("csrf") ?? "") !== actor.csrfToken) {
      return NextResponse.redirect(new URL(`${returnTo}?uploadError=${encodeURIComponent("Blocked request.")}`, request.url), 303);
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.redirect(new URL(`${returnTo}?uploadError=${encodeURIComponent("Choose a file.")}`, request.url), 303);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    await uploadProjectFile(actor, {
      projectId: String(form.get("projectId") ?? ""),
      originalName: file.name,
      mimeType: file.type,
      bytes,
      category: String(form.get("category") ?? "OTHER"),
      clientVisible: form.get("clientVisible") === "on",
      deliverableVersionId: String(form.get("deliverableVersionId") ?? "") || null,
      taskId: String(form.get("taskId") ?? "") || null,
    });
    const join = returnTo.includes("?") ? "&" : "?";
    return NextResponse.redirect(new URL(`${returnTo}${join}notice=uploaded`, request.url), 303);
  } catch (error) {
    if (error instanceof AppError) {
      const join = returnTo.includes("?") ? "&" : "?";
      return NextResponse.redirect(
        new URL(`${returnTo}${join}uploadError=${encodeURIComponent(error.message)}`, request.url),
        303,
      );
    }
    return errorResponse(error);
  }
}
