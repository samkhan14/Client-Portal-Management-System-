import { notFound, redirect } from "next/navigation";
import { invoiceAction, invoiceStatusAction } from "@/actions/app";
import { ActionForm } from "@/components/forms";
import { Badge, Empty, Notice } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { canSeeInternalFinancials } from "@/lib/authz";
import { INVOICE_STATUS_LABEL } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { formatDate, formatMoney, one } from "@/lib/format";
import { listInvoices } from "@/server/finance";
import { requireProject } from "@/server/projects";

export default async function ProjectInvoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!canSeeInternalFinancials(actor.role)) redirect(`/projects/${(await params).projectId}`);
  const { projectId } = await params;
  const sp = await searchParams;
  const project = await requireProject(actor, projectId).catch((error: unknown) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  const invoices = await listInvoices(actor, project.id);
  const back = `/projects/${project.id}/invoices`;
  return (
    <div className="space-y-4">
      <Notice code={one(sp.notice)} />
      <p className="help">Invoice records track unpaid, paid, or void. Northline does not take payment.</p>
      <div className="card p-4">
        <h2 className="font-semibold">New invoice</h2>
        <ActionForm action={invoiceAction} csrf={actor.csrfToken} submitLabel="Create invoice" hidden={{ projectId: project.id, returnTo: back }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="label">Number</span><input className="field" name="number" required placeholder="INV-1041" /></label>
            <label className="block"><span className="label">Amount</span><input className="field" name="amount" required inputMode="decimal" /></label>
          </div>
          <label className="block"><span className="label">Issued</span><input className="field" type="date" name="issuedDate" required /></label>
          <label className="block"><span className="label">Notes</span><textarea className="field" name="notes" rows={2} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="clientVisible" /> Visible to the client</label>
        </ActionForm>
      </div>
      {invoices.length === 0 ? <Empty title="No invoices" body="Create a record when you bill this project." /> : (
        <ul className="space-y-2">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="card p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{invoice.number} · {formatMoney(invoice.amount)}</p>
                <Badge value={invoice.status} label={INVOICE_STATUS_LABEL[invoice.status]} />
              </div>
              <p className="text-ink-500">Issued {formatDate(invoice.issuedDate)} · {invoice.clientVisible ? "Client visible" : "Internal"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["UNPAID", "PAID", "VOID"] as const).map((status) => (
                  <ActionForm key={status} action={invoiceStatusAction} csrf={actor.csrfToken} submitLabel={INVOICE_STATUS_LABEL[status]} hidden={{ invoiceId: invoice.id, status, returnTo: back }}>
                    <span className="sr-only">Mark {invoice.number} {status}</span>
                  </ActionForm>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
