<?php

namespace App\Http\Requests;

use App\Models\Invoice;
use App\Models\Project;
use App\Support\Access;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Invoice::class);
    }

    public function rules(): array
    {
        $orgId = Access::membership($this->user())?->organization_id;

        return [
            'project_id' => ['required', 'integer', function ($a, $value, $fail) use ($orgId) {
                $project = Project::query()->find($value);
                if (! $project || (int) $project->organization_id !== (int) $orgId) {
                    $fail('Choose a project in this agency.');
                }
            }],
            'number' => ['required', 'string', 'max:40', Rule::unique('invoices', 'number')->where('organization_id', $orgId)],
            'amount' => ['required', 'numeric', 'min:0'],
            'status' => ['required', Rule::in(['UNPAID', 'PAID', 'VOID'])],
            'client_visible' => ['sometimes', 'boolean'],
            'issued_on' => ['required', 'date'],
            'due_on' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'internal_notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
