<?php

namespace App\Http\Requests;

use App\Enums\MembershipRole;
use App\Models\Invitation;
use App\Support\Access;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreInvitationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Invitation::class);
    }

    public function rules(): array
    {
        $role = Access::role($this->user());
        $allowed = array_map(fn (MembershipRole $item) => $item->value, $role ? MembershipRole::invitableBy($role) : []);
        $orgId = Access::membership($this->user())?->organization_id;

        return [
            'email' => ['required', 'email', 'max:255'],
            'role' => ['required', Rule::in($allowed)],
            'client_company_id' => ['nullable', 'integer', Rule::exists('client_companies', 'id')->where('organization_id', $orgId)],
        ];
    }
}
