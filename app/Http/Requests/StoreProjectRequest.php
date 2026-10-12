<?php

namespace App\Http\Requests;

use App\Models\Project;
use App\Support\Access;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Project::class);
    }

    public function rules(): array
    {
        $orgId = Access::membership($this->user())?->organization_id;

        return [
            'name' => ['required', 'string', 'max:160'],
            'reference' => ['required', 'string', 'max:40', Rule::unique('projects', 'reference')->where('organization_id', $orgId)],
            'client_company_id' => ['required', 'integer', Rule::exists('client_companies', 'id')->where('organization_id', $orgId)],
            'description' => ['nullable', 'string', 'max:5000'],
            'scope' => ['nullable', 'string', 'max:5000'],
            'project_manager_id' => ['required', 'integer', Rule::exists('memberships', 'user_id')->where(fn ($q) => $q->where('organization_id', $orgId)->whereIn('role', ['AGENCY_OWNER', 'PROJECT_MANAGER']))],
            'priority' => ['required', Rule::in(['LOW', 'NORMAL', 'HIGH', 'URGENT'])],
            'start_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'budget' => ['nullable', 'numeric', 'min:0'],
            'agreed_fee' => ['nullable', 'numeric', 'min:0'],
            'fee_visible_to_client' => ['sometimes', 'boolean'],
            'member_ids' => ['array'],
            'member_ids.*' => ['integer'],
        ];
    }
}
