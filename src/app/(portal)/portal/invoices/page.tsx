import { redirect } from "next/navigation";
import { Badge, Empty } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { INVOICE_STATUS_LABEL } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { listInvoices } from "@/server/finance";

export default async function PortalInvoicesPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const invoices = await listInvoices(actor);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Invoices</h1>
      <p className="help">These are the invoices your team has chosen to share. Payment status is unpaid, paid, or void.</p>
      {invoices.length === 0 ? <Empty title="No invoices" body="Shared invoices will appear here." /> : (
        <ul className="space-y-2">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="card p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{invoice.number} · {formatMoney(invoice.amount)}</p>
                <Badge value={invoice.status} label={INVOICE_STATUS_LABEL[invoice.status]} />
              </div>
              <p className="text-ink-500">{invoice.project.name} · Issued {formatDate(invoice.issuedDate)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
