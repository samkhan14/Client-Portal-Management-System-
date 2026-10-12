<?php

namespace App\Http\Requests;

use App\Enums\MembershipRole;
use App\Models\Task;
use App\Models\TimeEntry;
use App\Support\Access;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTimeEntryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', [TimeEntry::class, $this->route('project')]);
    }

    public function rules(): array
    {
        $projectId = (int) $this->route('project')->id;

        return [
            'task_id' => ['nullable', 'integer', function ($a, $value, $fail) use ($projectId) {
                $task = Task::query()->find($value);
                if (! $task || (int) $task->project_id !== $projectId) {
                    $fail('That task is not part of this project.');
                }
            }],
            'user_id' => ['nullable', 'integer', Rule::exists('project_members', 'user_id')->where('project_id', $projectId)],
            'minutes' => ['required', 'integer', 'min:1', 'max:1440'],
            'work_date' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if (Access::role($this->user()) === MembershipRole::TeamMember && $this->filled('user_id') && (int) $this->input('user_id') !== $this->user()->id) {
                $validator->errors()->add('user_id', 'Team members can only log their own time.');
            }
        });
    }
}
