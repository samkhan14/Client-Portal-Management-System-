<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DecideChangeRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('decide', $this->route('changeRequest'));
    }

    public function rules(): array
    {
        return ['status' => ['required', Rule::in(['ACCEPTED', 'DECLINED'])], 'decision_note' => ['nullable', 'string', 'max:2000']];
    }
}
