import type { OrgRole, Priority, ProjectStatus, TaskStatus, DeliverableStatus, InvoiceStatus } from "@prisma/client";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  IN_PROGRESS: "In progress",
  WAITING_ON_CLIENT: "Waiting on client",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const PROJECT_STATUS_EXPLAIN: Record<ProjectStatus, string> = {
  PLANNING: "Scope and setup are still being confirmed. Delivery has not started.",
  IN_PROGRESS: "The team is actively working.",
  WAITING_ON_CLIENT: "Work is paused until you respond to the request below.",
  ON_HOLD: "This project is paused by agreement. No delivery is expected until it resumes.",
  COMPLETED: "The agreed work is finished.",
  CANCELLED: "This project will not continue.",
};

export const PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  PLANNING: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  IN_PROGRESS: ["WAITING_ON_CLIENT", "ON_HOLD", "COMPLETED", "CANCELLED", "PLANNING"],
  WAITING_ON_CLIENT: ["IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"],
  ON_HOLD: ["PLANNING", "IN_PROGRESS", "CANCELLED"],
  COMPLETED: ["IN_PROGRESS"],
  CANCELLED: ["PLANNING"],
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  IN_REVIEW: "In review",
  DONE: "Done",
};

export const TASK_STATUS_EXPLAIN: Record<TaskStatus, string> = {
  TODO: "Not started.",
  IN_PROGRESS: "Someone is working on this.",
  BLOCKED: "This cannot move until something else is resolved.",
  IN_REVIEW: "Work is ready for a check.",
  DONE: "Finished.",
};

export const TASK_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "DONE"];

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const ROLE_LABEL: Record<OrgRole, string> = {
  PLATFORM_ADMIN: "Platform admin",
  AGENCY_OWNER: "Agency owner",
  PROJECT_MANAGER: "Project manager",
  TEAM_MEMBER: "Team member",
  CLIENT_ADMIN: "Client admin",
  CLIENT_COLLABORATOR: "Client collaborator",
  READ_ONLY: "Read only",
};

export const DELIVERABLE_STATUS_LABEL: Record<DeliverableStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Awaiting your review",
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  UNPAID: "Unpaid",
  PAID: "Paid",
  VOID: "Void",
};

export const PAGE_SIZE = 20;

export const NOTICES: Record<string, string> = {
  saved: "Saved.",
  invited: "Invitation created. Copy the link below before you leave this page.",
  revoked: "Access removed.",
  submitted: "Submitted for review.",
  decided: "Decision recorded.",
  uploaded: "File uploaded.",
  deleted: "File removed.",
  scanned: "Deadline reminders checked.",
};
