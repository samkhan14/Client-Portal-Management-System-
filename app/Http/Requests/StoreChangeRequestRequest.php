<?php

namespace App\Http\Requests;

use App\Models\ChangeRequest;
use Illuminate\Foundation\Http\FormRequest;

class StoreChangeRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', [ChangeRequest::class, $this->route('project')]);
    }

    public function rules(): array
    {
        return ['title' => ['required', 'string', 'max:180'], 'description' => ['required', 'string', 'max:5000']];
    }
}
