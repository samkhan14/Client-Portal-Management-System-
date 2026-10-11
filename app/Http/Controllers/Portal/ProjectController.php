<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreChangeRequestRequest;
use App\Http\Requests\StoreCommentRequest;
use App\Http\Requests\StoreFileRequest;
use App\Models\Project;
use App\Services\CommentRecorder;
use App\Services\FileService;
use App\Services\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function show(Request $request, Project $project, Workspace $workspace): Response
    {
        return Inertia::render('Portal/Project', $workspace->portalProject($request, $project));
    }

    public function comment(StoreCommentRequest $request, Project $project, CommentRecorder $comments, FileService $files): RedirectResponse
    {
        $fileId = null;
        if ($request->file('upload')) {
            $file = $files->store($project, $request->user(), $request->file('upload'), true);
            $fileId = $file->id;
        }

        $comments->create($project, $request->user(), $request->string('body')->toString(), true, $request->input('task_id'), $fileId);

        return back()->with('success', 'Comment posted.');
    }

    public function upload(StoreFileRequest $request, Project $project, FileService $files): RedirectResponse
    {
        $files->store($project, $request->user(), $request->file('upload'), true);

        return back()->with('success', 'File shared.');
    }

    public function changeRequest(StoreChangeRequestRequest $request, Project $project, \App\Services\ActivityLogger $activities): RedirectResponse
    {
        $change = $project->changeRequests()->create([
            'requested_by' => $request->user()->id,
            'title' => $request->string('title')->toString(),
            'description' => $request->string('description')->toString(),
            'status' => \App\Enums\ChangeRequestStatus::Open,
        ]);
        $activities->log($project->organization_id, $project, $request->user(), 'change_request.opened', 'A change request was opened: '.$change->title, true, $change);

        return back()->with('success', 'Change request sent.');
    }
}
