import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Empty } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { canSeeInternalFinancials } from "@/lib/authz";
import { INVOICE_STATUS_LABEL } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { listInvoices } from "@/server/finance";

export default async function InvoicesPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!canSeeInternalFinancials(actor.role)) redirect("/dashboard");
  const invoices = await listInvoices(actor);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Invoices</h1>
      <p className="help">Status only: unpaid, paid, or void. There is no payment processor.</p>
      {invoices.length === 0 ? <Empty title="No invoices" body="Create one from a project." /> : (
        <ul className="space-y-2 text-sm">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="card flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <p className="font-medium">{invoice.number} · {formatMoney(invoice.amount)}</p>
                <p className="text-ink-500"><Link className="underline" href={`/projects/${invoice.project.id}`}>{invoice.project.reference}</Link> · {formatDate(invoice.issuedDate)} · {invoice.clientVisible ? "Client visible" : "Internal"}</p>
              </div>
              <Badge value={invoice.status} label={INVOICE_STATUS_LABEL[invoice.status]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
