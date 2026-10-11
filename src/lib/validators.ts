import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(200)
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200)
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

export const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const projectStatusSchema = z.enum([
  "PLANNING",
  "IN_PROGRESS",
  "WAITING_ON_CLIENT",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
]);
export const taskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "DONE"]);
export const inviteRoleSchema = z.enum([
  "AGENCY_OWNER",
  "PROJECT_MANAGER",
  "TEAM_MEMBER",
  "CLIENT_ADMIN",
  "CLIENT_COLLABORATOR",
  "READ_ONLY",
]);
export const fileCategorySchema = z.enum(["BRIEF", "DELIVERABLE", "REFERENCE", "CONTRACT", "OTHER"]);
export const invoiceStatusSchema = z.enum(["UNPAID", "PAID", "VOID"]);
export const changeRequestStatusSchema = z.enum(["REQUESTED", "APPROVED", "REJECTED"]);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

export const referenceSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{1,20}$/, "Use 2–21 letters, numbers, or hyphens.");
