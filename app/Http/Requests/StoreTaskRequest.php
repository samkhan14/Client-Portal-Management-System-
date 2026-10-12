<?php

namespace App\Http\Requests;

use App\Models\Task;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', [Task::class, $this->route('project')]);
    }

    public function rules(): array
    {
        $projectId = (int) $this->route('project')->id;

        return [

            'title' => ['required', 'string', 'max:180'],
            'description' => ['nullable', 'string', 'max:5000'],
            'assignee_id' => ['nullable', 'integer', Rule::exists('project_members', 'user_id')->where('project_id', $projectId)],
            'milestone_id' => ['nullable', 'integer', Rule::exists('milestones', 'id')->where('project_id', $projectId)],
            'priority' => ['required', Rule::in(['LOW', 'NORMAL', 'HIGH', 'URGENT'])],
            'start_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'estimate_hours' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'client_visible' => ['sometimes', 'boolean'],

            'parent_id' => ['nullable', 'integer', function ($attribute, $value, $fail) use ($projectId) {
                $parent = Task::query()->find($value);
                if (! $parent || (int) $parent->project_id !== $projectId) {
                    $fail('The subtask parent must be a task in this project.');

                    return;
                }
                if ($parent->parent_id) {
                    $fail('Subtasks can only be one level deep.');
                }
            }],
            'prerequisite_task_id' => ['nullable', 'integer', function ($attribute, $value, $fail) use ($projectId) {
                $other = Task::query()->find($value);
                if (! $other || (int) $other->project_id !== $projectId) {
                    $fail('The prerequisite must be another task in this project.');
                }
            }],
        ];
    }
}
