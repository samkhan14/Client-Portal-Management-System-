<?php

namespace App\Http\Requests;

use App\Support\Access;
use Illuminate\Foundation\Http\FormRequest;

class UpdateOrganizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $organization = Access::membership($this->user())?->organization;

        return $organization && $this->user()->can('update', $organization);
    }

    public function rules(): array
    {
        return ['name' => ['required', 'string', 'max:160'], 'hourly_rate' => ['required', 'numeric', 'min:0'], 'timezone' => ['required', 'timezone']];
    }
}
