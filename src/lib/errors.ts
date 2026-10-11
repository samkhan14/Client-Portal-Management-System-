import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(message = "Not found.") {
  return new AppError("NOT_FOUND", message, 404);
}

export function forbidden(message = "You do not have access to that.") {
  return new AppError("FORBIDDEN", message, 403);
}

export function publicError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the form and try again.";
  }
  console.error(error);
  return "Something went wrong.";
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Something went wrong." }, { status: 500 });
}

export function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}
