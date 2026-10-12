<?php

namespace App\Services;

use App\Enums\TaskStatus;
use Illuminate\Support\Facades\DB;

class ProjectProgress
{
    /** @param list<int> $projectIds @return array<int, int> */
    public function map(array $projectIds): array
    {
        $projectIds = array_values(array_unique(array_map('intval', $projectIds)));
        $results = array_fill_keys($projectIds, 0);
        if ($projectIds === []) {
            return [];
        }

        $taskCounts = DB::table('tasks')
            ->select('milestone_id')
            ->selectRaw('COUNT(*) as total_tasks')
            ->selectRaw('SUM(CASE WHEN status <> ? THEN 1 ELSE 0 END) as open_tasks', [TaskStatus::Done->value])
            ->whereNotNull('milestone_id')
            ->groupBy('milestone_id');

        $rows = DB::table('milestones')
            ->leftJoinSub($taskCounts, 'task_counts', 'task_counts.milestone_id', '=', 'milestones.id')
            ->whereIn('milestones.project_id', $projectIds)
            ->groupBy('milestones.project_id')
            ->select('milestones.project_id')
            ->selectRaw('COUNT(milestones.id) as total_milestones')
            ->selectRaw('SUM(CASE WHEN COALESCE(task_counts.total_tasks, 0) > 0 AND COALESCE(task_counts.open_tasks, 0) = 0 THEN 1 ELSE 0 END) as completed_milestones')
            ->get();

        foreach ($rows as $row) {
            $total = (int) $row->total_milestones;
            $completed = (int) $row->completed_milestones;
            $results[(int) $row->project_id] = $total === 0 ? 0 : (int) round(($completed * 100) / $total);
        }

        return $results;
    }

    public function percent(int $projectId): int
    {
        return $this->map([$projectId])[$projectId] ?? 0;
    }

    /** @return list<array<string, mixed>> */
    public function milestones(int $projectId): array
    {
        return DB::table('milestones')
            ->leftJoin('tasks', 'tasks.milestone_id', '=', 'milestones.id')
            ->where('milestones.project_id', $projectId)
            ->groupBy('milestones.id', 'milestones.name', 'milestones.description', 'milestones.due_date', 'milestones.sort')
            ->orderBy('milestones.sort')
            ->orderBy('milestones.id')
            ->select(['milestones.id', 'milestones.name', 'milestones.description', 'milestones.due_date', 'milestones.sort'])
            ->selectRaw('COUNT(tasks.id) as total_tasks')
            ->selectRaw('SUM(CASE WHEN tasks.status = ? THEN 1 ELSE 0 END) as done_tasks', [TaskStatus::Done->value])
            ->get()
            ->map(function ($row) {
                $total = (int) $row->total_tasks;
                $done = (int) $row->done_tasks;

                return [
                    'id' => (int) $row->id,
                    'name' => $row->name,
                    'description' => $row->description,
                    'due_date' => $row->due_date,
                    'sort' => (int) $row->sort,
                    'total_tasks' => $total,
                    'done_tasks' => $done,
                    'complete' => $total > 0 && $done === $total,
                ];
            })->all();
    }
}
