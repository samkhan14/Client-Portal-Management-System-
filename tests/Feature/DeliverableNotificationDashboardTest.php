<?php

namespace Tests\Feature;

use App\Enums\DeliverableStatus;
use App\Enums\MembershipRole;
use App\Enums\ProjectStatus;
use App\Enums\TaskStatus;
use App\Models\AppNotification;
use App\Models\Deliverable;
use App\Models\DeliverableVersion;
use App\Models\Milestone;
use App\Models\OutboundMessage;
use App\Models\Task;
use App\Services\NotificationWriter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Feature\Concerns\CreatesAgency;
use Tests\TestCase;

class DeliverableNotificationDashboardTest extends TestCase
{
    use CreatesAgency, RefreshDatabase;

    public function test_deliverable_versions_cannot_be_approved_twice_or_overwritten(): void
    {
        $org = $this->makeOrg();
        $company = $this->makeCompany($org, 'Brightwater');
        $owner = $this->makeUser('Owner');
        $pm = $this->makeUser('Manager');
        $team = $this->makeUser('Member');
        $admin = $this->makeUser('Client Admin');
        $this->join($owner, $org, MembershipRole::AgencyOwner);
        $this->join($pm, $org, MembershipRole::ProjectManager);
        $this->join($team, $org, MembershipRole::TeamMember);
        $this->join($admin, $org, MembershipRole::ClientAdmin, $company);
        $project = $this->makeProject($org, $company, $pm, 'NL-9', [$owner, $team, $admin], ProjectStatus::InProgress);

        $this->actingAs($pm)->post(route('deliverables.store', $project), [
            'title' => 'Label system',
            'summary' => 'First draft',
        ])->assertRedirect();
        $deliverable = Deliverable::query()->firstOrFail();
        $draft = $deliverable->versions()->firstOrFail();
        $this->actingAs($pm)->post(route('deliverables.submit', $draft))->assertRedirect();
        $this->actingAs($team)->post(route('deliverables.approve', $draft), ['decision_note' => 'no'])->assertRedirect(route('dashboard'));

        $this->actingAs($admin)->post(route('deliverables.approve', $draft), ['decision_note' => 'Approved for print.'])->assertRedirect();
        $this->actingAs($admin)->post(route('deliverables.approve', $draft), ['decision_note' => 'Second try'])->assertSessionHasErrors('decision');
        $draft->refresh();
        $this->assertSame(DeliverableStatus::Approved, $draft->status);
        $this->assertSame('Approved for print.', $draft->decision_note);
        $this->assertSame($admin->id, $draft->decided_by);

        $this->actingAs($pm)->put(route('deliverables.draft', $draft), ['summary' => 'Changed after approval'])->assertSessionHasErrors('summary');
        $this->assertSame('First draft', $draft->fresh()->summary);

        $this->actingAs($pm)->post(route('deliverables.versions.store', [$project, $deliverable]))->assertRedirect();
        $this->assertSame(2, DeliverableVersion::query()->count());
        $next = DeliverableVersion::query()->where('version_number', 2)->firstOrFail();
        $this->assertSame(DeliverableStatus::Draft, $next->status);
        $this->assertSame(DeliverableStatus::Approved, $draft->fresh()->status);
        $this->assertSame('Approved for print.', $draft->fresh()->decision_note);
    }

    public function test_notifications_are_deduped_and_dashboard_filters_use_sql_counts(): void
    {
        $org = $this->makeOrg();
        $company = $this->makeCompany($org, 'Brightwater');
        $owner = $this->makeUser('Owner');
        $pm = $this->makeUser('Manager');
        $team = $this->makeUser('Member');
        $this->join($owner, $org, MembershipRole::AgencyOwner);
        $this->join($pm, $org, MembershipRole::ProjectManager);
        $this->join($team, $org, MembershipRole::TeamMember);
        $mine = $this->makeProject($org, $company, $pm, 'NL-1', [$owner, $team], ProjectStatus::InProgress);
        $theirs = $this->makeProject($org, $company, $pm, 'NL-2', [$owner], ProjectStatus::WaitingOnClient);
        $theirs->update(['outstanding_request' => 'Need a logo.']);

        $writer = app(NotificationWriter::class);
        $writer->send($team, $org->id, 'assignment', 'task-assigned:9:'.$team->id, 'Task assigned', 'Safe assignment text');
        $writer->send($team, $org->id, 'assignment', 'task-assigned:9:'.$team->id, 'Task assigned', 'Safe assignment text');
        $this->assertSame(1, AppNotification::query()->where('user_id', $team->id)->count());
        $this->assertSame(1, OutboundMessage::query()->where('email', $team->email)->count());

        Task::query()->create([
            'project_id' => $mine->id,
            'title' => 'Due tomorrow',
            'creator_id' => $pm->id,
            'assignee_id' => $team->id,
            'status' => TaskStatus::Todo,
            'due_date' => now()->addDay()->toDateString(),
        ]);
        $this->artisan('portal:scan-due-tasks')->assertSuccessful();
        $this->artisan('portal:scan-due-tasks')->assertSuccessful();
        $this->assertSame(1, AppNotification::query()->where('user_id', $team->id)->where('type', 'due_soon')->count());

        Task::query()->create([
            'project_id' => $mine->id,
            'title' => 'Late on mine',
            'creator_id' => $pm->id,
            'assignee_id' => $team->id,
            'status' => TaskStatus::Todo,
            'due_date' => now()->subDay()->toDateString(),
        ]);
        Task::query()->create([
            'project_id' => $theirs->id,
            'title' => 'Late elsewhere',
            'creator_id' => $pm->id,
            'status' => TaskStatus::Todo,
            'due_date' => now()->subDays(2)->toDateString(),
        ]);
        $deliverable = Deliverable::query()->create(['project_id' => $mine->id, 'title' => 'Cut']);
        $deliverable->versions()->create(['version_number' => 1, 'status' => DeliverableStatus::Submitted, 'created_by' => $pm->id]);
        Milestone::query()->create(['project_id' => $mine->id, 'name' => 'Soon', 'due_date' => now()->addDays(3)->toDateString(), 'sort' => 1]);

        $this->actingAs($owner)->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
            ->where('summary.overdue_task_count', 2)
            ->where('summary.deliverables_awaiting_approval', 1)
            ->where('summary.outstanding_client_actions', 1)
            ->where('summary.projects_by_status.IN_PROGRESS', 1)
            ->where('summary.projects_by_status.WAITING_ON_CLIENT', 1)
            ->has('summary.upcoming_milestones', 1));

        $this->actingAs($team)->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
            ->where('summary.overdue_task_count', 1)
            ->where('summary.outstanding_client_actions', 0));

        foreach (range(1, 12) as $index) {
            $this->makeProject($org, $company, $pm, 'PG-'.$index, [$owner], ProjectStatus::InProgress);
        }
        $this->makeProject($org, $company, $pm, 'PLAN-1', [$owner], ProjectStatus::Planning);

        $this->actingAs($owner)->get('/projects?status=IN_PROGRESS')->assertInertia(fn (Assert $page) => $page
            ->where('projects.total', 13)
            ->where('projects.last_page', 2)
            ->has('projects.data', 10));
        $this->actingAs($owner)->get('/projects?status=IN_PROGRESS&page=2')->assertInertia(fn (Assert $page) => $page
            ->where('projects.current_page', 2)
            ->has('projects.data', 3));
        $this->actingAs($owner)->get('/projects?q=PLAN-1')->assertInertia(fn (Assert $page) => $page->where('projects.total', 1));
        $this->actingAs($team)->get('/tasks?status=TODO&assignee='.$team->id)->assertInertia(fn (Assert $page) => $page->where('tasks.total', 2));
    }
}
