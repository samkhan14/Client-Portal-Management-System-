export type ActionState = { error: string; link?: string };

export function safeReturnTo(value: FormDataEntryValue | null, fallback: string): string {
  const path = String(value ?? "");
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://") || path.includes("\\")) {
    return fallback;
  }
  return path.slice(0, 400);
}
