<?php

namespace App\Http\Controllers\Internal;

use App\Enums\ChangeRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\DecideChangeRequestRequest;
use App\Http\Requests\StoreChangeRequestRequest;
use App\Models\ChangeRequest;
use App\Models\Project;
use App\Services\ActivityLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;

class ChangeRequestController extends Controller
{
    public function store(StoreChangeRequestRequest $request, Project $project, ActivityLogger $activities): RedirectResponse
    {
        $change = $project->changeRequests()->create([
            'requested_by' => $request->user()->id,
            'title' => $request->string('title')->toString(),
            'description' => $request->string('description')->toString(),
            'status' => ChangeRequestStatus::Open,
        ]);
        $activities->log($project->organization_id, $project, $request->user(), 'change_request.opened', 'A change request was opened: '.$change->title, true, $change);

        return back()->with('success', 'Change request opened.');
    }

    public function decide(DecideChangeRequestRequest $request, ChangeRequest $changeRequest, ActivityLogger $activities): RedirectResponse
    {
        DB::transaction(function () use ($request, $changeRequest, $activities): void {
            $locked = ChangeRequest::query()->whereKey($changeRequest->id)->lockForUpdate()->firstOrFail();
            $locked->status = ChangeRequestStatus::from($request->string('status')->toString());
            $locked->decision_note = $request->input('decision_note');
            $locked->decided_by = $request->user()->id;
            $locked->decided_at = now();
            $locked->save();
            $activities->log($locked->project->organization_id, $locked->project, $request->user(), 'change_request.decided', 'Change request “'.$locked->title.'” was '.$locked->status->label().'.', true, $locked);
        });

        return back()->with('success', 'Change request updated.');
    }
}
