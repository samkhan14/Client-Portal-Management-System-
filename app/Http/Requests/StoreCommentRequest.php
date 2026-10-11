<?php

namespace App\Http\Requests;

use App\Models\Comment;
use App\Models\Task;
use Illuminate\Foundation\Http\FormRequest;

class StoreCommentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', [Comment::class, $this->route('project')]);
    }

    public function rules(): array
    {
        $projectId = (int) $this->route('project')->id;

        return [
            'body' => ['required', 'string', 'max:5000'],
            'client_visible' => ['sometimes', 'boolean'],
            'task_id' => ['nullable', 'integer', function ($a, $value, $fail) use ($projectId) {
                $task = Task::query()->find($value);
                if (! $task || (int) $task->project_id !== $projectId) {
                    $fail('That task is not part of this project.');
                }
            }],
            'upload' => ['nullable', 'file', 'max:10240'],
        ];
    }
}
