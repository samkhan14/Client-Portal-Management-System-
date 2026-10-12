<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreFileRequest;
use App\Models\Project;
use App\Models\StoredFile;
use App\Services\FileService;
use App\Support\Access;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FileController extends Controller
{
    public function store(StoreFileRequest $request, Project $project, FileService $files): RedirectResponse
    {
        $visible = Access::role($request->user())?->isClient() ? true : $request->boolean('client_visible');
        $files->store($project, $request->user(), $request->file('upload'), $visible);

        return back()->with('success', 'File stored.');
    }

    public function download(StoredFile $storedFile): StreamedResponse
    {
        $this->authorize('download', $storedFile);
        abort_unless(Storage::disk($storedFile->disk)->exists($storedFile->path), 404);

        return Storage::disk($storedFile->disk)->download($storedFile->path, $storedFile->original_name);
    }

    public function destroy(StoredFile $storedFile, FileService $files): RedirectResponse
    {
        $this->authorize('delete', $storedFile);
        $files->delete($storedFile, request()->user());

        return back()->with('success', 'File removed.');
    }
}
