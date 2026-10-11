<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Enums\ProjectPriority;
use App\Enums\ProjectStatus;
use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use App\Models\Membership;
use App\Models\ProjectMember;
use App\Models\StoredFile;
use App\Models\Task;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Feature\Concerns\CreatesAgency;
use Tests\TestCase;

class MemberAccessAndListingTest extends TestCase
{
    use CreatesAgency, RefreshDatabase;

    public function test_project_members_are_managed_inside_the_organization_and_client(): void
    {
        $org = $this->makeOrg();
        $other = $this->makeOrg('Other Agency');
        $company = $this->makeCompany($org, 'Brightwater');
        $kite = $this->makeCompany($org, 'Kite');
        $owner = $this->makeUser('Owner');
        $pm = $this->makeUser('Manager');
        $team = $this->makeUser('Member');
        $stranger = $this->makeUser('Studio Stranger');
        $kitePerson = $this->makeUser('Kite Person');
        $foreign = $this->makeUser('Foreign Person');
        $this->join($owner, $org, MembershipRole::AgencyOwner);
        $this->join($pm, $org, MembershipRole::ProjectManager);
        $this->join($team, $org, MembershipRole::TeamMember);
        $this->join($stranger, $org, MembershipRole::TeamMember);
        $this->join($kitePerson, $org, MembershipRole::ClientCollaborator, $kite);
        $this->join($foreign, $other, MembershipRole::TeamMember);
        $project = $this->makeProject($org, $company, $pm, 'NL-1', [$owner, $team]);

        $this->actingAs($team)->put(route('projects.members.sync', $project), [
            'member_ids' => [$pm->id, $stranger->id],
        ])->assertForbidden();

        $this->actingAs($owner)->put(route('projects.members.sync', $project), [
            'member_ids' => [$pm->id, $stranger->id],
        ])->assertRedirect();
        $this->assertTrue(ProjectMember::query()->where('project_id', $project->id)->where('user_id', $stranger->id)->exists());
        $this->assertFalse(ProjectMember::query()->where('project_id', $project->id)->where('user_id', $team->id)->exists());

        $this->actingAs($owner)->from(route('projects.show', $project))->put(route('projects.members.sync', $project), [
            'member_ids' => [$pm->id, $kitePerson->id],
        ])->assertSessionHasErrors('member_ids');
        $this->actingAs($owner)->from(route('projects.show', $project))->put(route('projects.members.sync', $project), [
            'member_ids' => [$pm->id, $foreign->id],
        ])->assertSessionHasErrors('member_ids');
        $this->assertFalse(ProjectMember::query()->where('project_id', $project->id)->where('user_id', $kitePerson->id)->exists());

        $this->actingAs($owner)->get(route('projects.show', $project))->assertInertia(fn (Assert $page) => $page
            ->where('candidates', function ($candidates) use ($stranger, $kitePerson, $foreign) {
                $ids = collect($candidates)->pluck('id');

                return $ids->contains($stranger->id)
                    && ! $ids->contains($kitePerson->id)
                    && ! $ids->contains($foreign->id);
            }));
    }

    public function test_task_options_include_every_task_in_the_project(): void
    {
        $org = $this->makeOrg();
        $company = $this->makeCompany($org, 'Brightwater');
        $owner = $this->makeUser('Owner');
        $this->join($owner, $org, MembershipRole::AgencyOwner);
        $project = $this->makeProject($org, $company, $owner, 'NL-1', [$owner]);
        foreach (range(1, 13) as $index) {
            Task::query()->create([
                'project_id' => $project->id,
                'title' => sprintf('Task %02d', $index),
                'creator_id' => $owner->id,
                'status' => TaskStatus::Todo,
                'priority' => TaskPriority::Normal,
            ]);
        }

        $this->actingAs($owner)->get(route('projects.show', $project))->assertInertia(fn (Assert $page) => $page
            ->has('tasks.data', 12)
            ->has('task_options', 13)
            ->where('task_options.12.title', 'Task 13'));
    }

    public function test_revoked_membership_blocks_sign_in_files_and_the_portal(): void
    {
        Storage::fake('local');
        $org = $this->makeOrg();
        $company = $this->makeCompany($org, 'Brightwater');
        $owner = $this->makeUser('Owner');
        $collab = $this->makeUser('Collaborator');
        $this->join($owner, $org, MembershipRole::AgencyOwner);
        $membership = $this->join($collab, $org, MembershipRole::ClientCollaborator, $company);
        $project = $this->makeProject($org, $company, $owner, 'NL-1', [$owner, $collab]);
        Storage::disk('local')->put('shared.txt', 'shared bytes');
        $shared = StoredFile::query()->create([
            'organization_id' => $org->id,
            'project_id' => $project->id,
            'uploaded_by' => $owner->id,
            'disk' => 'local',
            'path' => 'shared.txt',
            'original_name' => 'shared.txt',
            'mime' => 'text/plain',
            'size' => 12,
            'client_visible' => true,
        ]);
        $collab->forceFill(['remember_token' => 'remember-me-token'])->save();
        DB::table('sessions')->insert([
            'id' => 'revoked-session',
            'user_id' => $collab->id,
            'payload' => 'revoked',
            'last_activity' => time(),
        ]);

        $this->actingAs($collab)->get(route('files.download', $shared))->assertOk();
        $this->actingAs($owner)->delete(route('memberships.destroy', $membership))->assertRedirect();
        $this->assertNull(Membership::query()->find($membership->id));
        $this->assertSame(0, DB::table('sessions')->where('user_id', $collab->id)->count());
        $this->assertNotSame('remember-me-token', $collab->fresh()->remember_token);

        $this->actingAs($collab)->get(route('portal.home'))->assertForbidden();
        $this->actingAs($collab)->get(route('files.download', $shared))->assertNotFound();
        $this->actingAs($collab)->get(route('notifications.index'))->assertForbidden();
        $this->actingAs($collab)->get(route('dashboard'))->assertForbidden();

        $this->post('/logout');
        $this->post('/login', ['email' => $collab->email, 'password' => 'password'])
            ->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_file_downloads_fail_for_another_client_and_another_agency(): void
    {
        Storage::fake('local');
        $org = $this->makeOrg();
        $other = $this->makeOrg('Other Agency');
        $bright = $this->makeCompany($org, 'Brightwater');
        $kite = $this->makeCompany($org, 'Kite');
        $foreignCompany = $this->makeCompany($other, 'Foreign');
        $owner = $this->makeUser('Owner');
        $brightAdmin = $this->makeUser('Bright Admin');
        $kiteAdmin = $this->makeUser('Kite Admin');
        $outsider = $this->makeUser('Outsider');
        $this->join($owner, $org, MembershipRole::AgencyOwner);
        $this->join($brightAdmin, $org, MembershipRole::ClientAdmin, $bright);
        $this->join($kiteAdmin, $org, MembershipRole::ClientAdmin, $kite);
        $this->join($outsider, $other, MembershipRole::AgencyOwner);
        $harbor = $this->makeProject($org, $bright, $owner, 'NL-1', [$owner, $brightAdmin]);
        $foreign = $this->makeProject($other, $foreignCompany, $outsider, 'ZZ-1', [$outsider]);
        Storage::disk('local')->put('secret.txt', 'staff only');
        Storage::disk('local')->put('shared.txt', 'shared');
        Storage::disk('local')->put('foreign.txt', 'foreign');
        $secret = StoredFile::query()->create([
            'organization_id' => $org->id, 'project_id' => $harbor->id, 'uploaded_by' => $owner->id,
            'disk' => 'local', 'path' => 'secret.txt', 'original_name' => 'margin.txt', 'mime' => 'text/plain', 'size' => 8, 'client_visible' => false,
        ]);
        $shared = StoredFile::query()->create([
            'organization_id' => $org->id, 'project_id' => $harbor->id, 'uploaded_by' => $owner->id,
            'disk' => 'local', 'path' => 'shared.txt', 'original_name' => 'shared.txt', 'mime' => 'text/plain', 'size' => 6, 'client_visible' => true,
        ]);
        $foreignFile = StoredFile::query()->create([
            'organization_id' => $other->id, 'project_id' => $foreign->id, 'uploaded_by' => $outsider->id,
            'disk' => 'local', 'path' => 'foreign.txt', 'original_name' => 'foreign.txt', 'mime' => 'text/plain', 'size' => 7, 'client_visible' => true,
        ]);

        $this->actingAs($kiteAdmin)->get(route('files.download', $shared))->assertForbidden();
        $this->actingAs($kiteAdmin)->get(route('files.download', $secret))->assertForbidden();
        $this->actingAs($brightAdmin)->get(route('files.download', $secret))->assertForbidden();
        $this->actingAs($brightAdmin)->get(route('files.download', $shared))->assertOk();
        $this->actingAs($owner)->get(route('files.download', $foreignFile))->assertNotFound();
        $this->actingAs($outsider)->get(route('files.download', $shared))->assertNotFound();
    }

    public function test_project_and_task_filters_are_applied_on_the_server(): void
    {
        $org = $this->makeOrg();
        $company = $this->makeCompany($org, 'Brightwater');
        $owner = $this->makeUser('Owner');
        $team = $this->makeUser('Member');
        $this->join($owner, $org, MembershipRole::AgencyOwner);
        $this->join($team, $org, MembershipRole::TeamMember);
        $harbor = $this->makeProject($org, $company, $owner, 'NL-2401', [$owner, $team], ProjectStatus::InProgress);
        $harbor->update(['name' => 'Harbor packaging', 'priority' => ProjectPriority::High]);
        $this->makeProject($org, $company, $owner, 'NL-2402', [$owner], ProjectStatus::Planning);
        Task::query()->create([
            'project_id' => $harbor->id,
            'title' => 'Label copy',
            'creator_id' => $owner->id,
            'assignee_id' => $team->id,
            'status' => TaskStatus::Todo,
            'priority' => TaskPriority::High,
        ]);
        Task::query()->create([
            'project_id' => $harbor->id,
            'title' => 'Unrelated sketch',
            'creator_id' => $owner->id,
            'status' => TaskStatus::Done,
            'priority' => TaskPriority::Low,
        ]);

        $this->actingAs($owner)->get('/projects?q=Harbor&status=IN_PROGRESS&priority=HIGH&client='.$company->id)
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.q', 'Harbor')
                ->where('filters.status', 'IN_PROGRESS')
                ->where('filters.priority', 'HIGH')
                ->where('filters.client', (string) $company->id)
                ->where('projects.total', 1)
                ->where('projects.data.0.reference', 'NL-2401'));

        $this->actingAs($owner)->get('/tasks?q=Label&status=TODO&priority=HIGH&assignee='.$team->id)
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.q', 'Label')
                ->where('filters.status', 'TODO')
                ->where('filters.assignee', (string) $team->id)
                ->where('filters.priority', 'HIGH')
                ->where('tasks.total', 1)
                ->where('tasks.data.0.title', 'Label copy'));
    }
}
