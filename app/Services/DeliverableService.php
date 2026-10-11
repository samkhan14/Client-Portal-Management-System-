<?php

namespace App\Services;

use App\Enums\DeliverableStatus;
use App\Enums\MembershipRole;
use App\Models\Deliverable;
use App\Models\DeliverableVersion;
use App\Models\Membership;
use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DeliverableService
{
    public function __construct(private ActivityLogger $activities, private NotificationWriter $notifications) {}

    public function create(Project $project, User $actor, string $title, ?string $description, ?string $summary): Deliverable
    {
        return DB::transaction(function () use ($project, $actor, $title, $description, $summary) {
            $deliverable = Deliverable::query()->create(['project_id' => $project->id, 'title' => $title, 'description' => $description]);
            $deliverable->versions()->create(['version_number' => 1, 'status' => DeliverableStatus::Draft, 'summary' => $summary, 'created_by' => $actor->id]);
            $this->activities->log($project->organization_id, $project, $actor, 'deliverable.drafted', 'A draft deliverable was started.', false, $deliverable);

            return $deliverable->load('versions');
        });
    }

    public function startNextVersion(Deliverable $deliverable, User $actor): DeliverableVersion
    {
        return DB::transaction(function () use ($deliverable, $actor) {
            $locked = Deliverable::query()->whereKey($deliverable->id)->lockForUpdate()->firstOrFail();
            $latest = $locked->versions()->orderByDesc('version_number')->lockForUpdate()->first();
            if ($latest && in_array($latest->status, [DeliverableStatus::Draft, DeliverableStatus::Submitted], true)) {
                throw ValidationException::withMessages(['version' => 'Finish the current version before starting another.']);
            }
            $version = $locked->versions()->create([
                'version_number' => ($latest->version_number ?? 0) + 1,
                'status' => DeliverableStatus::Draft,
                'summary' => $latest?->summary,
                'created_by' => $actor->id,
            ]);
            $project = $locked->project;
            $this->activities->log($project->organization_id, $project, $actor, 'deliverable.version_opened', 'A new version of “'.$locked->title.'” was opened. Earlier versions were left unchanged.', false, $version);

            return $version;
        });
    }

    public function updateDraft(DeliverableVersion $version, User $actor, ?string $summary): DeliverableVersion
    {
        return DB::transaction(function () use ($version, $summary) {
            $locked = DeliverableVersion::query()->whereKey($version->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== DeliverableStatus::Draft) {
                throw ValidationException::withMessages(['summary' => 'Only a draft can be edited. Approved versions stay as they were.']);
            }
            $locked->summary = $summary;
            $locked->save();

            return $locked;
        });
    }

    public function submit(DeliverableVersion $version, User $actor): DeliverableVersion
    {
        return DB::transaction(function () use ($version, $actor) {
            $locked = DeliverableVersion::query()->whereKey($version->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== DeliverableStatus::Draft) {
                throw ValidationException::withMessages(['status' => 'Only a draft can be submitted.']);
            }
            $locked->forceFill(['status' => DeliverableStatus::Submitted, 'submitted_by' => $actor->id, 'submitted_at' => now()])->save();
            $deliverable = $locked->deliverable()->with('project')->firstOrFail();
            $project = $deliverable->project;
            $this->activities->log($project->organization_id, $project, $actor, 'deliverable.submitted', '“'.$deliverable->title.'” version '.$locked->version_number.' was submitted for review.', true, $locked);
            $admins = Membership::query()->with('user')->where('organization_id', $project->organization_id)->where('client_company_id', $project->client_company_id)->where('role', MembershipRole::ClientAdmin)->get();
            foreach ($admins as $membership) {
                $this->notifications->send($membership->user, $project->organization_id, 'deliverable', 'deliverable-submitted:'.$locked->id.':'.$membership->user_id, 'Deliverable ready for review', '“'.$deliverable->title.'” version '.$locked->version_number.' is ready for your review.');
            }

            return $locked;
        });
    }

    public function decide(DeliverableVersion $version, User $actor, DeliverableStatus $decision, string $note): DeliverableVersion
    {
        if (! in_array($decision, [DeliverableStatus::Approved, DeliverableStatus::ChangesRequested], true)) {
            throw ValidationException::withMessages(['decision' => 'Choose approval or a request for changes.']);
        }

        return DB::transaction(function () use ($version, $actor, $decision, $note) {
            $locked = DeliverableVersion::query()->whereKey($version->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== DeliverableStatus::Submitted) {
                throw ValidationException::withMessages(['decision' => 'This version is no longer awaiting a decision.']);
            }
            $locked->forceFill(['status' => $decision, 'decided_by' => $actor->id, 'decided_at' => now(), 'decision_note' => $note])->save();
            $deliverable = $locked->deliverable()->with('project.manager')->firstOrFail();
            $project = $deliverable->project;
            $approved = $decision === DeliverableStatus::Approved;
            $this->activities->log(
                $project->organization_id,
                $project,
                $actor,
                $approved ? 'deliverable.approved' : 'deliverable.changes_requested',
                $approved ? '“'.$deliverable->title.'” version '.$locked->version_number.' was approved.' : 'Changes were requested on “'.$deliverable->title.'” version '.$locked->version_number.'.',
                true,
                $locked,
            );
            foreach (collect([$project->manager, $locked->submitter])->filter()->unique('id') as $recipient) {
                if ($recipient->id === $actor->id) {
                    continue;
                }
                $this->notifications->send($recipient, $project->organization_id, 'deliverable', ($approved ? 'deliverable-approved:' : 'deliverable-changes:').$locked->id.':'.$recipient->id, $approved ? 'Deliverable approved' : 'Changes requested', $approved ? '“'.$deliverable->title.'” version '.$locked->version_number.' was approved.' : 'Changes were requested on “'.$deliverable->title.'” version '.$locked->version_number.'.');
            }

            return $locked;
        });
    }
}
