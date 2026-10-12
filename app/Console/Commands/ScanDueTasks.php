<?php

namespace App\Console\Commands;

use App\Enums\TaskStatus;
use App\Models\Task;
use App\Services\NotificationWriter;
use Illuminate\Console\Command;

class ScanDueTasks extends Command
{
    protected $signature = 'portal:scan-due-tasks';

    protected $description = 'Queue due-soon notifications for tasks due within two days';

    public function handle(NotificationWriter $notifications): int
    {
        $tasks = Task::query()
            ->with(['assignee', 'project'])
            ->whereNotNull('assignee_id')
            ->whereNotNull('due_date')
            ->whereDate('due_date', '>=', today())
            ->whereDate('due_date', '<=', today()->addDays(2))
            ->where('status', '<>', TaskStatus::Done->value)
            ->get();

        foreach ($tasks as $task) {
            if (! $task->assignee || ! $task->project) {
                continue;
            }
            $notifications->send(
                $task->assignee,
                $task->project->organization_id,
                'due_soon',
                'due-soon:'.$task->id.':'.$task->due_date->toDateString(),
                'Task due soon',
                '“'.$task->title.'” is due '.$task->due_date->toFormattedDateString().'.',
            );
        }

        $this->info('Scanned '.$tasks->count().' due-soon tasks.');

        return self::SUCCESS;
    }
}
