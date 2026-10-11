<?php

namespace App\Http\Requests;

use App\Support\Access;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateClientCompanyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('clientCompany'));
    }

    public function rules(): array
    {
        $orgId = Access::membership($this->user())?->organization_id;

        return ['name' => ['required', 'string', 'max:160'], 'slug' => ['required', 'string', 'max:80', 'alpha_dash', Rule::unique('client_companies', 'slug')->where('organization_id', $orgId)->ignore($this->route('clientCompany')->id)], 'website' => ['nullable', 'string', 'max:255'], 'notes' => ['nullable', 'string', 'max:5000']];
    }
}
