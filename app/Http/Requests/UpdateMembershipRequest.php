<?php

namespace App\Http\Requests;

use App\Support\Access;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMembershipRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('membership'));
    }

    public function rules(): array
    {
        $orgId = Access::membership($this->user())?->organization_id;

        return [
            'role' => ['required', Rule::in(['AGENCY_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER', 'CLIENT_ADMIN', 'CLIENT_COLLABORATOR', 'READ_ONLY'])],
            'client_company_id' => ['nullable', 'integer', Rule::exists('client_companies', 'id')->where('organization_id', $orgId)],
        ];
    }
}
