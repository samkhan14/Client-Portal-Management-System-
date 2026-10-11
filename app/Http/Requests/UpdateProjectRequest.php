<?php

namespace App\Http\Requests;

use App\Support\Access;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('project'));
    }

    public function rules(): array
    {
        $orgId = Access::membership($this->user())?->organization_id;
        $project = $this->route('project');

        return [
            'name' => ['required', 'string', 'max:160'],
            'reference' => ['required', 'string', 'max:40', Rule::unique('projects', 'reference')->where('organization_id', $orgId)->ignore($project->id)],
            'description' => ['nullable', 'string', 'max:5000'],
            'scope' => ['nullable', 'string', 'max:5000'],
            'project_manager_id' => ['required', 'integer', Rule::exists('memberships', 'user_id')->where(fn ($q) => $q->where('organization_id', $orgId)->whereIn('role', ['AGENCY_OWNER', 'PROJECT_MANAGER']))],
            'priority' => ['required', Rule::in(['LOW', 'NORMAL', 'HIGH', 'URGENT'])],
            'start_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'budget' => ['nullable', 'numeric', 'min:0'],
            'agreed_fee' => ['nullable', 'numeric', 'min:0'],
            'fee_visible_to_client' => ['sometimes', 'boolean'],
            'outstanding_request' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
