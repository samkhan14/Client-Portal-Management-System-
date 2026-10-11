<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreOnboardingItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('clientCompany'));
    }

    public function rules(): array
    {
        return ['title' => ['required', 'string', 'max:180'], 'detail' => ['nullable', 'string', 'max:2000']];
    }
}
