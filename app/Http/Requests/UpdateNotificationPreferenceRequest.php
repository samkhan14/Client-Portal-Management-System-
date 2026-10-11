<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateNotificationPreferenceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return ['assignments' => ['required', 'boolean'], 'due_soon' => ['required', 'boolean'], 'comments' => ['required', 'boolean'], 'deliverables' => ['required', 'boolean'], 'status_changes' => ['required', 'boolean'], 'invitations' => ['required', 'boolean']];
    }
}
