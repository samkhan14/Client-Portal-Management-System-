<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DecideDeliverableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('decide', $this->route('version'));
    }

    public function rules(): array
    {
        return ['decision_note' => ['required', 'string', 'max:2000']];
    }
}
