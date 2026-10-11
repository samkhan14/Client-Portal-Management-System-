<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCommentRequest;
use App\Models\Project;
use App\Services\CommentRecorder;
use App\Services\FileService;
use Illuminate\Http\RedirectResponse;

class CommentController extends Controller
{
    public function store(StoreCommentRequest $request, Project $project, CommentRecorder $comments, FileService $files): RedirectResponse
    {
        $fileId = null;
        if ($request->file('upload')) {
            $fileId = $files->store($project, $request->user(), $request->file('upload'), $request->boolean('client_visible'))->id;
        }
        $comments->create($project, $request->user(), $request->string('body')->toString(), $request->boolean('client_visible'), $request->input('task_id'), $fileId);

        return back()->with('success', 'Comment posted.');
    }
}
