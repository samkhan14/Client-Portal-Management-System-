import fs from "node:fs/promises";
import path from "node:path";
import { AppError } from "@/lib/errors";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const EXTENSIONS: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "text/plain": ["txt"],
  "text/csv": ["csv"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/zip": ["zip"],
};

export const ALLOWED_MIME_TYPES = Object.keys(EXTENSIONS);

const ROOT = path.resolve(process.cwd(), "storage", "uploads");

export function assertFileAllowed(originalName: string, mimeType: string, bytes: Buffer): string {
  if (bytes.length === 0) throw new AppError("FILE", "The file is empty.");
  if (bytes.length > MAX_FILE_BYTES) throw new AppError("FILE", "Files must be 10 MB or smaller.");
  const extensions = EXTENSIONS[mimeType];
  if (!extensions) throw new AppError("FILE", "That file type is not allowed.");
  const extension = originalName.split(".").pop()?.toLowerCase() ?? "";
  if (!extensions.includes(extension)) {
    throw new AppError("FILE", "The file extension does not match its type.");
  }
  if (!magicMatches(mimeType, bytes)) {
    throw new AppError("FILE", "The file content does not match its type.");
  }
  const safeName = path.basename(originalName).replace(/[^A-Za-z0-9._ -]/g, "").slice(0, 180);
  if (!safeName || safeName === "." || safeName === "..") {
    throw new AppError("FILE", "The file name is not valid.");
  }
  return safeName;
}

function magicMatches(mimeType: string, bytes: Buffer): boolean {
  if (mimeType === "application/pdf") return bytes.subarray(0, 5).toString("utf8") === "%PDF-";
  if (mimeType === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/gif") {
    const header = bytes.subarray(0, 6).toString("utf8");
    return header === "GIF87a" || header === "GIF89a";
  }
  if (mimeType === "image/webp") {
    return bytes.subarray(0, 4).toString("utf8") === "RIFF" && bytes.subarray(8, 12).toString("utf8") === "WEBP";
  }
  if (
    mimeType === "application/zip" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return bytes[0] === 0x50 && bytes[1] === 0x4b;
  }
  if (mimeType === "text/plain" || mimeType === "text/csv") {
    return !bytes.subarray(0, Math.min(bytes.length, 8000)).includes(0);
  }
  return false;
}

export function storagePath(storageKey: string): string {
  if (!storageKey || storageKey.includes("..")) {
    throw new AppError("FILE", "Invalid file path.");
  }
  const full = path.resolve(ROOT, storageKey);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
    throw new AppError("FILE", "Invalid file path.");
  }
  return full;
}

export async function writeStoredFile(storageKey: string, bytes: Buffer): Promise<void> {
  const full = storagePath(storageKey);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, bytes, { flag: "wx" });
}

export async function readStoredFile(storageKey: string): Promise<Buffer> {
  return fs.readFile(storagePath(storageKey));
}

export async function removeStoredFile(storageKey: string): Promise<void> {
  try {
    await fs.unlink(storagePath(storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
