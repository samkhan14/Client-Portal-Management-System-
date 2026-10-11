<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SyncProjectMembersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manageMembers', $this->route('project'));
    }

    public function rules(): array
    {
        return ['member_ids' => ['array'], 'member_ids.*' => ['integer']];
    }
}
