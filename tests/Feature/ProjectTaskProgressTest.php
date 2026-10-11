<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Enums\ProjectStatus;
use App\Enums\TaskStatus;
use App\Models\Milestone;
use App\Models\Task;
use App\Services\ProjectProgress;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\CreatesAgency;
use Tests\TestCase;

class ProjectTaskProgressTest extends TestCase
{
    use CreatesAgency, RefreshDatabase;

    public function test_project_and_task_rules_and_milestone_math(): void
    {
        $org = $this->makeOrg();
        $company = $this->makeCompany($org, 'Brightwater');
        $otherCompany = $this->makeCompany($org, 'Kite');
        $owner = $this->makeUser('Owner');
        $pm = $this->makeUser('Manager');
        $team = $this->makeUser('Member');
        $stranger = $this->makeUser('Stranger');
        $this->join($owner, $org, MembershipRole::AgencyOwner);
        $this->join($pm, $org, MembershipRole::ProjectManager);
        $this->join($team, $org, MembershipRole::TeamMember);
        $this->join($stranger, $org, MembershipRole::TeamMember);

        $first = $this->makeProject($org, $company, $pm, 'NL-1', [$owner, $team], ProjectStatus::Planning);
        $second = $this->makeProject($org, $otherCompany, $pm, 'NL-2', [$owner], ProjectStatus::InProgress);
        $otherTask = Task::query()->create(['project_id' => $second->id, 'title' => 'Elsewhere', 'creator_id' => $pm->id, 'status' => TaskStatus::Todo]);

        $this->actingAs($pm)->post(route('tasks.store', $first), [
            'title' => 'Child',
            'priority' => 'NORMAL',
            'parent_id' => $otherTask->id,
        ])->assertSessionHasErrors('parent_id');

        $this->actingAs($pm)->post(route('tasks.store', $first), [
            'title' => 'Depends',
            'priority' => 'NORMAL',
            'prerequisite_task_id' => $otherTask->id,
        ])->assertSessionHasErrors('prerequisite_task_id');

        $this->actingAs($pm)->post(route('tasks.store', $first), [
            'title' => 'Bad assignee',
            'priority' => 'NORMAL',
            'assignee_id' => $stranger->id,
        ])->assertSessionHasErrors('assignee_id');

        $this->actingAs($team)->post(route('projects.status', $first), ['status' => 'IN_PROGRESS'])->assertForbidden();
        $this->actingAs($owner)->post(route('projects.status', $first), ['status' => 'COMPLETED'])->assertSessionHasErrors('status');
        $this->actingAs($owner)->post(route('projects.status', $first), ['status' => 'IN_PROGRESS'])->assertRedirect();
        $this->assertSame(ProjectStatus::InProgress, $first->fresh()->status);

        $this->actingAs($owner)->post(route('projects.status', $first), ['status' => 'WAITING_ON_CLIENT'])->assertSessionHasErrors('outstanding_request');
        $this->actingAs($owner)->post(route('projects.status', $first), [
            'status' => 'WAITING_ON_CLIENT',
            'outstanding_request' => 'Please send the fictional logo pack.',
        ])->assertRedirect();
        $this->assertSame('Please send the fictional logo pack.', $first->fresh()->outstanding_request);

        $this->actingAs($pm)->post(route('tasks.store', $first), [
            'title' => 'Assigned work',
            'priority' => 'HIGH',
            'assignee_id' => $team->id,
            'client_visible' => true,
        ])->assertRedirect();
        $created = Task::query()->where('title', 'Assigned work')->firstOrFail();
        $this->actingAs($stranger)->post(route('tasks.status', [$first, $created]), ['status' => 'IN_PROGRESS'])->assertForbidden();
        $this->actingAs($team)->post(route('tasks.status', [$first, $created]), ['status' => 'IN_PROGRESS'])->assertRedirect();
        $this->actingAs($team)->post(route('tasks.status', [$first, $created]), ['status' => 'DONE'])->assertSessionHasErrors('status');

        $done = Milestone::query()->create(['project_id' => $first->id, 'name' => 'Done', 'sort' => 1]);
        $open = Milestone::query()->create(['project_id' => $first->id, 'name' => 'Open', 'sort' => 2]);
        $empty = Milestone::query()->create(['project_id' => $first->id, 'name' => 'Empty', 'sort' => 3]);
        Task::query()->create(['project_id' => $first->id, 'milestone_id' => $done->id, 'title' => 'Finished', 'creator_id' => $pm->id, 'status' => TaskStatus::Done]);
        Task::query()->create(['project_id' => $first->id, 'milestone_id' => $open->id, 'title' => 'Still open', 'creator_id' => $pm->id, 'status' => TaskStatus::Todo]);
        $progress = app(ProjectProgress::class);
        $this->assertSame(33, $progress->percent($first->id));
        $rows = collect($progress->milestones($first->id))->keyBy('name');
        $this->assertTrue($rows['Done']['complete']);
        $this->assertFalse($rows['Open']['complete']);
        $this->assertFalse($rows['Empty']['complete']);

        $bare = $this->makeProject($org, $company, $pm, 'NL-0', [$owner]);
        $this->assertSame(0, $progress->percent($bare->id));
        Milestone::query()->create(['project_id' => $bare->id, 'name' => 'Only empty', 'sort' => 1]);
        $this->assertSame(0, $progress->percent($bare->id));

        $prerequisite = Task::query()->create(['project_id' => $first->id, 'title' => 'First', 'creator_id' => $pm->id, 'status' => TaskStatus::Todo]);
        $blocked = Task::query()->create([
            'project_id' => $first->id,
            'title' => 'Second',
            'creator_id' => $pm->id,
            'assignee_id' => $team->id,
            'status' => TaskStatus::InReview,
            'prerequisite_task_id' => $prerequisite->id,
        ]);
        $this->actingAs($pm)->post(route('tasks.status', [$first, $blocked]), ['status' => 'DONE'])->assertSessionHasErrors('status');
        $prerequisite->update(['status' => TaskStatus::Done]);
        $this->actingAs($pm)->post(route('tasks.status', [$first, $blocked]), ['status' => 'DONE'])->assertRedirect();
    }
}
