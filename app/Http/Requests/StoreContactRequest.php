<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreContactRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('clientCompany'));
    }

    public function rules(): array
    {
        return ['name' => ['required', 'string', 'max:160'], 'email' => ['nullable', 'email', 'max:255'], 'phone' => ['nullable', 'string', 'max:40'], 'title' => ['nullable', 'string', 'max:120']];
    }
}
