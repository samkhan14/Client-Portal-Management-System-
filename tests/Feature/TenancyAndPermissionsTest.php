<?php

namespace Tests\Feature;

use App\Enums\DeliverableStatus;
use App\Enums\MembershipRole;
use App\Enums\TaskStatus;
use App\Models\Comment;
use App\Models\Deliverable;
use App\Models\Invoice;
use App\Models\StoredFile;
use App\Models\Task;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Feature\Concerns\CreatesAgency;
use Tests\TestCase;

class TenancyAndPermissionsTest extends TestCase
{
    use CreatesAgency, RefreshDatabase;

    public function test_organizations_and_client_companies_are_isolated(): void
    {
        Storage::fake('local');
        $north = $this->makeOrg('Northline');
        $other = $this->makeOrg('Other Agency');
        $bright = $this->makeCompany($north, 'Brightwater');
        $kite = $this->makeCompany($north, 'Kite');
        $foreignCompany = $this->makeCompany($other, 'Foreign');

        $owner = $this->makeUser('Owner One');
        $pm = $this->makeUser('Manager One');
        $team = $this->makeUser('Team One');
        $admin = $this->makeUser('Client Admin');
        $collab = $this->makeUser('Client Collab');
        $reader = $this->makeUser('Client Reader');
        $outsider = $this->makeUser('Outsider Owner');

        $this->join($owner, $north, MembershipRole::AgencyOwner);
        $this->join($pm, $north, MembershipRole::ProjectManager);
        $this->join($team, $north, MembershipRole::TeamMember);
        $this->join($admin, $north, MembershipRole::ClientAdmin, $bright);
        $this->join($collab, $north, MembershipRole::ClientCollaborator, $bright);
        $this->join($reader, $north, MembershipRole::ReadOnly, $bright);
        $this->join($outsider, $other, MembershipRole::AgencyOwner);

        $harbor = $this->makeProject($north, $bright, $pm, 'NL-1', [$owner, $team, $admin, $collab, $reader]);
        $hidden = $this->makeProject($north, $bright, $pm, 'NL-2', [$owner, $admin]);
        $kiteProject = $this->makeProject($north, $kite, $pm, 'NL-3', [$owner]);
        $foreign = $this->makeProject($other, $foreignCompany, $outsider, 'ZZ-1', [$outsider]);

        $task = Task::query()->create([
            'project_id' => $harbor->id,
            'title' => 'Visible task',
            'creator_id' => $pm->id,
            'assignee_id' => $team->id,
            'status' => TaskStatus::Todo,
            'client_visible' => true,
            'estimate_hours' => 8,
        ]);
        $foreignTask = Task::query()->create([
            'project_id' => $foreign->id,
            'title' => 'Foreign task',
            'creator_id' => $outsider->id,
            'status' => TaskStatus::Todo,
        ]);
        Comment::query()->create([
            'organization_id' => $north->id,
            'project_id' => $harbor->id,
            'user_id' => $pm->id,
            'body' => 'Secret internal margin sentence.',
            'client_visible' => false,
        ]);
        $deliverable = Deliverable::query()->create(['project_id' => $harbor->id, 'title' => 'Labels']);
        $version = $deliverable->versions()->create([
            'version_number' => 1,
            'status' => DeliverableStatus::Submitted,
            'created_by' => $pm->id,
        ]);
        $foreignVersion = Deliverable::query()->create(['project_id' => $foreign->id, 'title' => 'Foreign'])->versions()->create([
            'version_number' => 1,
            'status' => DeliverableStatus::Submitted,
            'created_by' => $outsider->id,
        ]);
        $invoice = Invoice::query()->create([
            'organization_id' => $north->id,
            'project_id' => $harbor->id,
            'client_company_id' => $bright->id,
            'number' => 'INV-1',
            'amount_cents' => 1000,
            'status' => 'UNPAID',
            'client_visible' => false,
            'issued_on' => now()->toDateString(),
            'internal_notes' => 'Hidden cost note',
        ]);
        $foreignInvoice = Invoice::query()->create([
            'organization_id' => $other->id,
            'project_id' => $foreign->id,
            'client_company_id' => $foreignCompany->id,
            'number' => 'INV-9',
            'amount_cents' => 1000,
            'status' => 'UNPAID',
            'client_visible' => true,
            'issued_on' => now()->toDateString(),
        ]);
        Storage::disk('local')->put('secret.txt', 'staff only bytes');
        Storage::disk('local')->put('shared.txt', 'shared bytes');
        $secret = StoredFile::query()->create([
            'organization_id' => $north->id, 'project_id' => $harbor->id, 'uploaded_by' => $pm->id,
            'disk' => 'local', 'path' => 'secret.txt', 'original_name' => 'secret.txt', 'mime' => 'text/plain', 'size' => 10, 'client_visible' => false,
        ]);
        $shared = StoredFile::query()->create([
            'organization_id' => $north->id, 'project_id' => $harbor->id, 'uploaded_by' => $pm->id,
            'disk' => 'local', 'path' => 'shared.txt', 'original_name' => 'shared.txt', 'mime' => 'text/plain', 'size' => 10, 'client_visible' => true,
        ]);
        $foreignFile = StoredFile::query()->create([
            'organization_id' => $other->id, 'project_id' => $foreign->id, 'uploaded_by' => $outsider->id,
            'disk' => 'local', 'path' => 'shared.txt', 'original_name' => 'foreign.txt', 'mime' => 'text/plain', 'size' => 10, 'client_visible' => true,
        ]);

        $this->actingAs($outsider)->get(route('projects.show', $harbor))->assertNotFound();
        $this->actingAs($outsider)->put(route('tasks.update', [$foreign, $task]), ['title' => 'x', 'priority' => 'NORMAL'])->assertNotFound();
        $this->actingAs($owner)->put(route('tasks.update', [$harbor, $foreignTask]), ['title' => 'Nope', 'priority' => 'NORMAL'])->assertNotFound();
        $this->actingAs($owner)->get(route('files.download', $foreignFile))->assertNotFound();
        $this->actingAs($owner)->put(route('invoices.update', $foreignInvoice), ['number' => 'INV-9', 'amount' => 10, 'status' => 'PAID', 'issued_on' => now()->toDateString()])->assertNotFound();
        $this->actingAs($admin)->post(route('deliverables.approve', $foreignVersion), ['decision_note' => 'no'])->assertNotFound();

        $this->actingAs($admin)->get(route('portal.home'))->assertInertia(fn (Assert $page) => $page
            ->has('projects', 2)
            ->where('projects.0.reference', 'NL-2')
            ->where('projects.1.reference', 'NL-1'));
        $this->actingAs($collab)->get(route('portal.home'))->assertInertia(fn (Assert $page) => $page->has('projects', 1)->where('projects.0.reference', 'NL-1'));
        $this->actingAs($collab)->get(route('portal.projects.show', $hidden))->assertForbidden();
        $this->actingAs($admin)->get(route('portal.projects.show', $kiteProject))->assertForbidden();

        $this->actingAs($admin)->get(route('portal.projects.show', $harbor))
            ->assertOk()
            ->assertDontSee('Secret internal margin sentence.')
            ->assertDontSee('Hidden cost note')
            ->assertDontSee('secret.txt')
            ->assertInertia(fn (Assert $page) => $page->where('tasks.data.0.estimate_hours', null)->missing('project.budget'));

        $this->actingAs($pm)->get(route('projects.show', $harbor))->assertSee('Secret internal margin sentence.');
        $this->actingAs($team)->get(route('projects.show', $harbor))->assertDontSee('Budget');

        $this->actingAs($admin)->get(route('files.download', $secret))->assertForbidden();
        $this->actingAs($admin)->get(route('files.download', $shared))->assertOk();
        $this->actingAs($reader)->post(route('portal.comments.store', $harbor), ['body' => 'Hello'])->assertForbidden();
        $this->actingAs($collab)->post(route('deliverables.approve', $version), ['decision_note' => 'Looks good'])->assertForbidden();
        $this->actingAs($team)->post(route('projects.status', $harbor), ['status' => 'IN_PROGRESS'])->assertForbidden();
        $this->actingAs($team)->post(route('invitations.store'), ['email' => 'new@example.test', 'role' => 'TEAM_MEMBER'])->assertForbidden();
        $this->actingAs($pm)->put(route('settings.update'), ['name' => 'Nope', 'hourly_rate' => 10, 'timezone' => 'UTC'])->assertForbidden();
        $this->actingAs($pm)->post(route('invoices.store'), [
            'project_id' => $harbor->id, 'number' => 'INV-2', 'amount' => 10, 'status' => 'UNPAID', 'issued_on' => now()->toDateString(),
        ])->assertForbidden();

        $this->actingAs($owner)->delete(route('files.destroy', $shared))->assertRedirect();
        $this->actingAs($admin)->get(route('files.download', $shared))->assertNotFound();
        $this->get('/storage/secret.txt')->assertNotFound();

        UploadedFile::fake()->create('notes.txt', 1, 'text/plain');
        $this->assertNotNull($invoice);
    }
}
