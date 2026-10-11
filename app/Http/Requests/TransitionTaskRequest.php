<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TransitionTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('transition', $this->route('task'));
    }

    public function rules(): array
    {
        return ['status' => ['required', Rule::in(['TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE'])]];
    }
}
