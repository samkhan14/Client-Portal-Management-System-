<?php

namespace App\Services;

use App\Models\Project;
use App\Models\StoredFile;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FileService
{
    public const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'zip'];

    public const ALLOWED_MIMES = [
        'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'text/plain', 'text/csv',
        'application/csv', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip', 'application/x-zip-compressed', 'application/octet-stream', 'application/x-empty',
    ];

    public function __construct(private ActivityLogger $activities) {}

    public function store(Project $project, User $actor, UploadedFile $upload, bool $clientVisible): StoredFile
    {
        $extension = strtolower($upload->getClientOriginalExtension());
        $mime = (string) $upload->getMimeType();
        if (! in_array($extension, self::ALLOWED_EXTENSIONS, true) || ! in_array($mime, self::ALLOWED_MIMES, true)) {
            throw ValidationException::withMessages(['upload' => 'That file type is not allowed.']);
        }
        if (($upload->getSize() ?: 0) > 10 * 1024 * 1024) {
            throw ValidationException::withMessages(['upload' => 'Files must be 10 MB or smaller.']);
        }

        return DB::transaction(function () use ($project, $actor, $upload, $clientVisible, $extension) {
            $path = $upload->storeAs('projects/'.$project->id, Str::uuid()->toString().'.'.$extension, 'local');
            $file = StoredFile::query()->create([
                'organization_id' => $project->organization_id,
                'project_id' => $project->id,
                'uploaded_by' => $actor->id,
                'disk' => 'local',
                'path' => $path,
                'original_name' => $upload->getClientOriginalName(),
                'mime' => (string) $upload->getMimeType(),
                'size' => $upload->getSize() ?: 0,
                'client_visible' => $clientVisible,
            ]);
            $this->activities->log($project->organization_id, $project, $actor, 'file.uploaded', $clientVisible ? 'A shared file was added.' : 'An internal file was added.', $clientVisible, $file);

            return $file;
        });
    }

    public function delete(StoredFile $file, User $actor): void
    {
        DB::transaction(function () use ($file, $actor): void {
            $locked = StoredFile::query()->whereKey($file->id)->lockForUpdate()->firstOrFail();
            Storage::disk($locked->disk)->delete($locked->path);
            if ($locked->project) {
                $this->activities->log($locked->organization_id, $locked->project, $actor, 'file.deleted', $locked->client_visible ? 'A shared file was removed.' : 'An internal file was removed.', (bool) $locked->client_visible);
            }
            $locked->delete();
        });
    }
}
