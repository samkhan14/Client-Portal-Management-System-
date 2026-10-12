<?php

namespace App\Http\Controllers\Internal;

use App\Enums\MembershipRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTimeEntryRequest;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Support\Access;
use Illuminate\Http\RedirectResponse;

class TimeEntryController extends Controller
{
    public function store(StoreTimeEntryRequest $request, Project $project): RedirectResponse
    {
        $userId = Access::role($request->user()) === MembershipRole::TeamMember
            ? $request->user()->id
            : (int) ($request->input('user_id') ?: $request->user()->id);

        TimeEntry::query()->create([
            'project_id' => $project->id,
            'task_id' => $request->input('task_id'),
            'user_id' => $userId,
            'minutes' => $request->integer('minutes'),
            'work_date' => $request->input('work_date'),
            'note' => $request->input('note'),
        ]);

        return back()->with('success', 'Time logged.');
    }
}
