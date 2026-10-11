<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreMilestoneRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('project'));
    }

    public function rules(): array
    {
        return ['name' => ['required', 'string', 'max:160'], 'description' => ['nullable', 'string', 'max:2000'], 'due_date' => ['nullable', 'date']];
    }
}
