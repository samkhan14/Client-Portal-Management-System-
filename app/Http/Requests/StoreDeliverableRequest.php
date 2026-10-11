<?php

namespace App\Http\Requests;

use App\Models\DeliverableVersion;
use Illuminate\Foundation\Http\FormRequest;

class StoreDeliverableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('draft', [DeliverableVersion::class, $this->route('project')]);
    }

    public function rules(): array
    {
        return ['title' => ['required', 'string', 'max:180'], 'description' => ['nullable', 'string', 'max:5000'], 'summary' => ['nullable', 'string', 'max:5000']];
    }
}
