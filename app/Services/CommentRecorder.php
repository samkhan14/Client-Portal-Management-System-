<?php

namespace App\Services;

use App\Enums\MembershipRole;
use App\Models\Comment;
use App\Models\Membership;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CommentRecorder
{
    public function __construct(private ActivityLogger $activities, private NotificationWriter $notifications) {}

    public function create(Project $project, User $actor, string $body, bool $clientVisible, ?int $taskId = null, ?int $fileId = null): Comment
    {
        return DB::transaction(function () use ($project, $actor, $body, $clientVisible, $taskId, $fileId) {
            if ($actor->currentMembership()?->role->isClient()) {
                $clientVisible = true;
            }
            $comment = Comment::query()->create([
                'organization_id' => $project->organization_id,
                'project_id' => $project->id,
                'task_id' => $taskId,
                'user_id' => $actor->id,
                'body' => $body,
                'client_visible' => $clientVisible,
                'file_id' => $fileId,
            ]);
            $this->activities->log($project->organization_id, $project, $actor, 'comment.posted', $clientVisible ? 'A comment was posted on '.$project->name.'.' : 'An internal note was added.', $clientVisible, $comment);

            $staffIds = Membership::query()->where('organization_id', $project->organization_id)->whereIn('role', [MembershipRole::AgencyOwner, MembershipRole::ProjectManager])->pluck('user_id');
            $memberIds = ProjectMember::query()->where('project_id', $project->id)->pluck('user_id');
            $recipientIds = $clientVisible
                ? $staffIds->merge($memberIds)->merge(Membership::query()->where('organization_id', $project->organization_id)->where('client_company_id', $project->client_company_id)->where('role', MembershipRole::ClientAdmin)->pluck('user_id'))
                : $staffIds->merge(Membership::query()->where('organization_id', $project->organization_id)->where('role', MembershipRole::TeamMember)->whereIn('user_id', $memberIds)->pluck('user_id'));

            foreach (User::query()->whereIn('id', $recipientIds->unique()->reject(fn ($id) => (int) $id === $actor->id))->get() as $user) {
                $this->notifications->send($user, $project->organization_id, 'comment', 'comment:'.$comment->id.':'.$user->id, $clientVisible ? 'New comment' : 'Internal note', $clientVisible ? $actor->name.' commented on '.$project->name.'.' : 'An internal note was added on '.$project->name.'.');
            }

            return $comment;
        });
    }
}
