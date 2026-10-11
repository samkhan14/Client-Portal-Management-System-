<?php

namespace App\Http\Requests;

use App\Models\StoredFile;
use Illuminate\Foundation\Http\FormRequest;

class StoreFileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('upload', [StoredFile::class, $this->route('project')]);
    }

    public function rules(): array
    {
        return ['upload' => ['required', 'file', 'max:10240'], 'client_visible' => ['sometimes', 'boolean']];
    }
}
