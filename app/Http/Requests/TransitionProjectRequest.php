<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TransitionProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('transition', $this->route('project'));
    }

    public function rules(): array
    {
        return ['status' => ['required', Rule::in(['PLANNING', 'IN_PROGRESS', 'WAITING_ON_CLIENT', 'ON_HOLD', 'COMPLETED', 'CANCELLED'])], 'outstanding_request' => ['nullable', 'string', 'max:2000']];
    }
}
