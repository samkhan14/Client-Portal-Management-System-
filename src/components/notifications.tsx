import Link from "next/link";
import { readNotificationAction, scanDeadlinesAction } from "@/actions/app";
import { ActionForm } from "@/components/forms";
import { Empty, Notice } from "@/components/ui";
import { formatWhen } from "@/lib/format";

export function NotificationsView({
  items,
  csrf,
  notice,
  returnTo,
  canScan = false,
}: {
  items: { id: string; title: string; body: string; linkPath: string | null; readAt: Date | null; createdAt: Date }[];
  csrf: string;
  notice?: string;
  returnTo: string;
  canScan?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <ActionForm action={readNotificationAction} csrf={csrf} submitLabel="Mark all read" hidden={{ notificationId: "all", returnTo }}>
          <span className="sr-only">Mark every notification read</span>
        </ActionForm>
      </div>
      <Notice code={notice} />
      {canScan ? (
        <ActionForm action={scanDeadlinesAction} csrf={csrf} submitLabel="Check approaching deadlines" pendingLabel="Checking…">
          <p className="help">Looks for open tasks due inside the organization’s reminder window.</p>
        </ActionForm>
      ) : null}
      {items.length === 0 ? <Empty title="You’re caught up" body="Assignments, reviews, and reminders will land here." /> : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className={`card p-3 ${item.readAt ? "opacity-70" : ""}`}>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-ink-600">{item.body}</p>
              <p className="mt-1 text-xs text-ink-500">{formatWhen(item.createdAt)}</p>
              <div className="mt-2 flex gap-3 text-sm">
                {item.linkPath ? <Link className="text-pine-800 underline" href={item.linkPath}>Open</Link> : null}
                {!item.readAt ? (
                  <ActionForm action={readNotificationAction} csrf={csrf} submitLabel="Mark read" hidden={{ notificationId: item.id, returnTo }}>
                    <span className="sr-only">Mark {item.title} read</span>
                  </ActionForm>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
