<?php

namespace App\Http\Controllers\Internal;

use App\Enums\InvoiceStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreInvoiceRequest;
use App\Http\Requests\UpdateInvoiceRequest;
use App\Models\Invoice;
use App\Models\Project;
use App\Services\Money;
use App\Support\Access;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InvoiceController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Invoice::class);
        $role = Access::role($request->user());
        $query = Invoice::query()->with('project:id,name')->where('organization_id', Access::membership($request->user())->organization_id);
        if ($role?->isClient()) {
            $query->where('client_visible', true)->whereHas('project', fn ($projects) => $projects->visibleTo($request->user()));
        }
        $invoices = $query->latest()->paginate(15)->withQueryString();

        return Inertia::render('Internal/Invoices/Index', [
            'invoices' => [
                'data' => $invoices->getCollection()->map(fn (Invoice $invoice) => [
                    'id' => $invoice->id, 'number' => $invoice->number, 'project' => $invoice->project?->name, 'project_id' => $invoice->project_id,
                    'amount' => Money::format($invoice->amount_cents), 'amount_value' => number_format($invoice->amount_cents / 100, 2, '.', ''),
                    'status' => $invoice->status->value, 'status_label' => $invoice->status->label(), 'client_visible' => $invoice->client_visible,
                    'issued_on' => $invoice->issued_on?->toDateString(), 'due_on' => $invoice->due_on?->toDateString(),
                    'notes' => $invoice->notes, 'internal_notes' => $role?->isClient() ? null : $invoice->internal_notes,
                ])->values(),
                'current_page' => $invoices->currentPage(), 'last_page' => $invoices->lastPage(), 'total' => $invoices->total(),
            ],
            'projects' => Project::query()->visibleTo($request->user())->orderBy('name')->get(['id', 'name']),
            'can_manage' => $request->user()->can('create', Invoice::class),
        ]);
    }

    public function store(StoreInvoiceRequest $request): RedirectResponse
    {
        $project = Project::query()->findOrFail($request->integer('project_id'));
        Invoice::query()->create([
            'organization_id' => $project->organization_id, 'project_id' => $project->id, 'client_company_id' => $project->client_company_id,
            'number' => $request->string('number')->toString(), 'amount_cents' => Money::dollarsToCents($request->input('amount')),
            'status' => InvoiceStatus::from($request->string('status')->toString()), 'client_visible' => $request->boolean('client_visible'),
            'issued_on' => $request->input('issued_on'), 'due_on' => $request->input('due_on'),
            'notes' => $request->input('notes'), 'internal_notes' => $request->input('internal_notes'),
        ]);

        return back()->with('success', 'Invoice recorded.');
    }

    public function update(UpdateInvoiceRequest $request, Invoice $invoice): RedirectResponse
    {
        $invoice->update([
            'number' => $request->string('number')->toString(), 'amount_cents' => Money::dollarsToCents($request->input('amount')),
            'status' => InvoiceStatus::from($request->string('status')->toString()), 'client_visible' => $request->boolean('client_visible'),
            'issued_on' => $request->input('issued_on'), 'due_on' => $request->input('due_on'),
            'notes' => $request->input('notes'), 'internal_notes' => $request->input('internal_notes'),
        ]);

        return back()->with('success', 'Invoice updated.');
    }
}
