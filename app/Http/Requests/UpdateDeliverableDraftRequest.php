<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateDeliverableDraftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('submit', $this->route('version'));
    }

    public function rules(): array
    {
        return ['summary' => ['nullable', 'string', 'max:5000']];
    }
}
