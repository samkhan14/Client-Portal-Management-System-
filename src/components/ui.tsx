import Link from "next/link";
import { NOTICES } from "@/lib/constants";

export function Notice({ code }: { code?: string }) {
  if (!code || !NOTICES[code]) return null;
  return (
    <p role="status" className="rounded-md border border-pine-100 bg-pine-50 px-3 py-2 text-sm text-pine-800">
      {NOTICES[code]}
    </p>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white px-4 py-8 text-center">
      <p className="font-medium text-ink-800">{title}</p>
      <p className="mt-1 text-sm text-ink-500">{body}</p>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-sm">
      <p className="text-ink-500">
        Page {page} of {pages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className="btn-secondary" href={hrefFor(page - 1)}>
            Previous
          </Link>
        ) : (
          <span className="btn-secondary opacity-50">Previous</span>
        )}
        {page < pages ? (
          <Link className="btn-secondary" href={hrefFor(page + 1)}>
            Next
          </Link>
        ) : (
          <span className="btn-secondary opacity-50">Next</span>
        )}
      </div>
    </nav>
  );
}

const TONES: Record<string, string> = {
  PLANNING: "bg-sea-50 text-sea-700",
  IN_PROGRESS: "bg-pine-50 text-pine-800",
  WAITING_ON_CLIENT: "bg-clay-50 text-clay-700",
  ON_HOLD: "bg-ink-900/5 text-ink-700",
  COMPLETED: "bg-pine-100 text-pine-800",
  CANCELLED: "bg-red-50 text-red-800",
  TODO: "bg-ink-900/5 text-ink-700",
  BLOCKED: "bg-red-50 text-red-800",
  IN_REVIEW: "bg-clay-50 text-clay-700",
  DONE: "bg-pine-50 text-pine-800",
  LOW: "bg-ink-900/5 text-ink-600",
  MEDIUM: "bg-sea-50 text-sea-700",
  HIGH: "bg-clay-50 text-clay-700",
  URGENT: "bg-red-50 text-red-800",
  DRAFT: "bg-ink-900/5 text-ink-700",
  SUBMITTED: "bg-clay-50 text-clay-700",
  APPROVED: "bg-pine-50 text-pine-800",
  CHANGES_REQUESTED: "bg-red-50 text-red-800",
  UNPAID: "bg-clay-50 text-clay-700",
  PAID: "bg-pine-50 text-pine-800",
  VOID: "bg-ink-900/5 text-ink-600",
  REQUESTED: "bg-clay-50 text-clay-700",
  REJECTED: "bg-red-50 text-red-800",
};

export function Badge({ value, label }: { value: string; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[value] ?? "bg-ink-900/5 text-ink-700"}`}>
      {label}
    </span>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  const safe = Math.max(0, Math.min(100, percent));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-ink-900/10" role="img" aria-label={`${safe}% of milestones complete`}>
      <div className="h-full rounded-full bg-pine-700" style={{ width: `${safe}%` }} />
    </div>
  );
}
