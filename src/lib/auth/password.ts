import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

let dummyHash: string | null = null;

export async function hashPassword(password: string, rounds = 12): Promise<string> {
  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!dummyHash) {
    dummyHash = await bcrypt.hash("northline-dummy-password", 12);
  }
  return bcrypt.compare(password, hash ?? dummyHash);
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
