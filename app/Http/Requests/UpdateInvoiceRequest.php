<?php

namespace App\Http\Requests;

use App\Support\Access;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('invoice'));
    }

    public function rules(): array
    {
        $orgId = Access::membership($this->user())?->organization_id;

        return [
            'number' => ['required', 'string', 'max:40', Rule::unique('invoices', 'number')->where('organization_id', $orgId)->ignore($this->route('invoice')->id)],
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
