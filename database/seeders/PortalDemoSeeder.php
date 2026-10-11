<?php

namespace Database\Seeders;

use App\Enums\ChangeRequestStatus;
use App\Enums\DeliverableStatus;
use App\Enums\InvoiceStatus;
use App\Enums\MembershipRole;
use App\Enums\ProjectPriority;
use App\Enums\ProjectStatus;
use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use App\Models\Activity;
use App\Models\AppNotification;
use App\Models\ChangeRequest;
use App\Models\ClientCompany;
use App\Models\Comment;
use App\Models\Contact;
use App\Models\Deliverable;
use App\Models\Invoice;
use App\Models\Membership;
use App\Models\Milestone;
use App\Models\OnboardingItem;
use App\Models\Organization;
use App\Models\OutboundMessage;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\StoredFile;
use App\Models\Task;
use App\Models\TimeEntry;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;

class PortalDemoSeeder extends Seeder
{
    public function run(): void
    {
        $studio = Organization::query()->create([
            'name' => 'Northline Studio',
            'slug' => 'northline-studio',
            'hourly_rate_cents' => 15000,
            'timezone' => 'America/Chicago',
        ]);

        $brightwater = ClientCompany::query()->create([
            'organization_id' => $studio->id,
            'name' => 'Brightwater Foods',
            'slug' => 'brightwater-foods',
            'website' => 'https://brightwater.example',
            'notes' => 'Fictional regional grocer. Internal note: spring campaign margin is not shared with the client.',
        ]);
        $kite = ClientCompany::query()->create([
            'organization_id' => $studio->id,
            'name' => 'Kite & Co.',
            'slug' => 'kite-and-co',
            'website' => 'https://kiteandco.example',
            'notes' => 'Fictional paper-goods maker. Keep their work separate from Brightwater.',
        ]);

        $ada = $this->person('Ada Okonkwo', 'ada@northline.example', true);
        $mara = $this->person('Mara Ellison', 'mara@northline.example');
        $jonah = $this->person('Jonah Hale', 'jonah@northline.example');
        $priya = $this->person('Priya Shah', 'priya@northline.example');
        $lena = $this->person('Lena Cho', 'lena@northline.example');
        $camille = $this->person('Camille Bright', 'camille@brightwater.example');
        $owen = $this->person('Owen Pike', 'owen@brightwater.example');
        $ruth = $this->person('Ruth Gale', 'ruth@brightwater.example');
        $helen = $this->person('Helen Cho', 'helen@kiteandco.example');
        $nico = $this->person('Nico Vale', 'nico@kiteandco.example');

        $this->join($studio, $mara, MembershipRole::AgencyOwner);
        $this->join($studio, $jonah, MembershipRole::ProjectManager);
        $this->join($studio, $priya, MembershipRole::TeamMember);
        $this->join($studio, $lena, MembershipRole::TeamMember);
        $this->join($studio, $camille, MembershipRole::ClientAdmin, $brightwater);
        $this->join($studio, $owen, MembershipRole::ClientCollaborator, $brightwater);
        $this->join($studio, $ruth, MembershipRole::ReadOnly, $brightwater);
        $this->join($studio, $helen, MembershipRole::ClientAdmin, $kite);
        $this->join($studio, $nico, MembershipRole::ClientCollaborator, $kite);

        Contact::query()->create(['client_company_id' => $brightwater->id, 'name' => 'Camille Bright', 'email' => 'camille@brightwater.example', 'title' => 'Brand director', 'phone' => '312-555-0148']);
        Contact::query()->create(['client_company_id' => $kite->id, 'name' => 'Helen Cho', 'email' => 'helen@kiteandco.example', 'title' => 'Founder']);
        OnboardingItem::query()->create(['client_company_id' => $brightwater->id, 'title' => 'Collect brand guidelines', 'detail' => 'Fictional PDF already received.', 'is_complete' => true, 'sort' => 1]);
        OnboardingItem::query()->create(['client_company_id' => $brightwater->id, 'title' => 'Confirm tasting locations', 'detail' => 'Waiting on Camille.', 'is_complete' => false, 'sort' => 2]);
        OnboardingItem::query()->create(['client_company_id' => $kite->id, 'title' => 'Kickoff call', 'is_complete' => false, 'sort' => 1]);

        $harbor = $this->project($studio, $brightwater, $jonah, 'Harbor packaging refresh', 'NL-2401', ProjectStatus::InProgress, ProjectPriority::High, now()->addDays(21), 840000, 1200000, true);
        $tasting = $this->project($studio, $brightwater, $jonah, 'Spring tasting film', 'NL-2402', ProjectStatus::WaitingOnClient, ProjectPriority::Normal, now()->addDays(12), 420000, 640000, false);
        $tasting->update(['outstanding_request' => 'Please confirm the spring tasting lineup so the edit can lock.']);
        $identity = $this->project($studio, $kite, $jonah, 'Identity guidelines', 'NL-2408', ProjectStatus::Planning, ProjectPriority::Normal, now()->addDays(40), 300000, 480000, false);

        foreach ([$mara, $jonah, $priya, $camille, $owen, $ruth] as $member) {
            ProjectMember::query()->create(['project_id' => $harbor->id, 'user_id' => $member->id]);
        }
        foreach ([$mara, $jonah, $priya, $camille] as $member) {
            ProjectMember::query()->create(['project_id' => $tasting->id, 'user_id' => $member->id]);
        }
        foreach ([$jonah, $lena, $helen] as $member) {
            ProjectMember::query()->create(['project_id' => $identity->id, 'user_id' => $member->id]);
        }

        $discovery = Milestone::query()->create(['project_id' => $harbor->id, 'name' => 'Discovery', 'description' => 'Audit the current harbor labels.', 'due_date' => now()->subDays(3)->toDateString(), 'sort' => 1]);
        $design = Milestone::query()->create(['project_id' => $harbor->id, 'name' => 'Design', 'description' => 'A new label system for the fictional harbor line.', 'due_date' => now()->addDays(7)->toDateString(), 'sort' => 2]);
        Milestone::query()->create(['project_id' => $harbor->id, 'name' => 'Launch', 'description' => 'No tasks yet, so this milestone is not complete.', 'due_date' => now()->addDays(20)->toDateString(), 'sort' => 3]);
        Milestone::query()->create(['project_id' => $tasting->id, 'name' => 'Picture lock', 'due_date' => now()->addDays(6)->toDateString(), 'sort' => 1]);

        $audit = $this->task($harbor, $discovery, $jonah, $priya, 'Audit existing labels', TaskStatus::Done, true, now()->subDays(10));
        $this->task($harbor, $discovery, $jonah, $priya, 'Interview the brand desk', TaskStatus::Done, true, now()->subDays(8));
        $system = $this->task($harbor, $design, $jonah, $priya, 'Draw the label system', TaskStatus::InProgress, true, now()->addDays(4), 12);
        $this->task($harbor, $design, $jonah, $priya, 'Internal print check', TaskStatus::Todo, false, now()->subDay(), 3, $system->id);
        $this->task($harbor, $design, $jonah, $lena, 'Subtask: check the clay ink', TaskStatus::Todo, false, now()->addDay(), null, null, $system->id);
        $this->task($tasting, null, $jonah, $priya, 'Cut the tasting reel', TaskStatus::InReview, true, now()->addDay());
        $this->task($identity, null, $jonah, $lena, 'Sketch the kite mark', TaskStatus::Todo, false, now()->addDays(9));

        $labels = Deliverable::query()->create(['project_id' => $harbor->id, 'title' => 'Harbor label system', 'description' => 'Fictional packaging system.']);
        $labels->versions()->create([
            'version_number' => 1,
            'status' => DeliverableStatus::Approved,
            'summary' => 'Approved harbor label system, version 1. This version must stay unchanged.',
            'created_by' => $jonah->id,
            'submitted_by' => $jonah->id,
            'submitted_at' => now()->subDays(6),
            'decided_by' => $camille->id,
            'decided_at' => now()->subDays(5),
            'decision_note' => 'Approved for the fictional harbor line.',
        ]);
        $labels->versions()->create([
            'version_number' => 2,
            'status' => DeliverableStatus::Draft,
            'summary' => 'A follow-up version for the seasonal sticker. Version 1 remains approved.',
            'created_by' => $priya->id,
        ]);
        $film = Deliverable::query()->create(['project_id' => $tasting->id, 'title' => 'Tasting film cut', 'description' => 'Ready for Camille to review.']);
        $film->versions()->create([
            'version_number' => 1,
            'status' => DeliverableStatus::Submitted,
            'summary' => 'Picture cut of the spring tasting film.',
            'created_by' => $jonah->id,
            'submitted_by' => $jonah->id,
            'submitted_at' => now()->subDay(),
        ]);
        $guide = Deliverable::query()->create(['project_id' => $identity->id, 'title' => 'Kite wordmark', 'description' => 'Changes were requested, then a new version was opened.']);
        $guide->versions()->create([
            'version_number' => 1,
            'status' => DeliverableStatus::ChangesRequested,
            'summary' => 'First kite wordmark.',
            'created_by' => $lena->id,
            'submitted_by' => $lena->id,
            'submitted_at' => now()->subDays(2),
            'decided_by' => $helen->id,
            'decided_at' => now()->subDay(),
            'decision_note' => 'Please loosen the letterspacing.',
        ]);
        $guide->versions()->create([
            'version_number' => 2,
            'status' => DeliverableStatus::Draft,
            'summary' => 'Second kite wordmark. Version 1 was not overwritten.',
            'created_by' => $lena->id,
        ]);

        Comment::query()->create([
            'organization_id' => $studio->id,
            'project_id' => $harbor->id,
            'user_id' => $jonah->id,
            'body' => 'Internal margin note: the clay ink overrun stays off the client record.',
            'client_visible' => false,
        ]);
        Comment::query()->create([
            'organization_id' => $studio->id,
            'project_id' => $harbor->id,
            'user_id' => $camille->id,
            'body' => 'The harbor label feels right for the spring shelf.',
            'client_visible' => true,
        ]);

        Activity::query()->create(['organization_id' => $studio->id, 'project_id' => $harbor->id, 'actor_id' => $camille->id, 'event' => 'deliverable.approved', 'summary' => '“Harbor label system” version 1 was approved.', 'client_visible' => true]);
        Activity::query()->create(['organization_id' => $studio->id, 'project_id' => $harbor->id, 'actor_id' => $jonah->id, 'event' => 'comment.posted', 'summary' => 'An internal note was added.', 'client_visible' => false]);
        Activity::query()->create(['organization_id' => $studio->id, 'project_id' => $tasting->id, 'actor_id' => $jonah->id, 'event' => 'project.status_changed', 'summary' => 'Project status changed from In progress to Waiting on client.', 'client_visible' => true]);

        Storage::disk('local')->put('projects/'.$harbor->id.'/harbor-brief.txt', 'Shared fictional brief for Brightwater Foods.');
        Storage::disk('local')->put('projects/'.$harbor->id.'/margin-sheet.txt', 'Internal estimate. Not for the client.');
        StoredFile::query()->create(['organization_id' => $studio->id, 'project_id' => $harbor->id, 'uploaded_by' => $jonah->id, 'disk' => 'local', 'path' => 'projects/'.$harbor->id.'/harbor-brief.txt', 'original_name' => 'harbor-brief.txt', 'mime' => 'text/plain', 'size' => 48, 'client_visible' => true]);
        StoredFile::query()->create(['organization_id' => $studio->id, 'project_id' => $harbor->id, 'uploaded_by' => $jonah->id, 'disk' => 'local', 'path' => 'projects/'.$harbor->id.'/margin-sheet.txt', 'original_name' => 'margin-sheet.txt', 'mime' => 'text/plain', 'size' => 40, 'client_visible' => false]);

        TimeEntry::query()->create(['project_id' => $harbor->id, 'task_id' => $system->id, 'user_id' => $priya->id, 'minutes' => 90, 'work_date' => now()->toDateString(), 'note' => 'Label sketches.']);
        ChangeRequest::query()->create(['project_id' => $tasting->id, 'requested_by' => $camille->id, 'title' => 'Add the orchard shot', 'description' => 'Please include the fictional orchard still if the lineup is confirmed.', 'status' => ChangeRequestStatus::Open]);

        Invoice::query()->create(['organization_id' => $studio->id, 'project_id' => $harbor->id, 'client_company_id' => $brightwater->id, 'number' => 'INV-1042', 'amount_cents' => 480000, 'status' => InvoiceStatus::Unpaid, 'client_visible' => true, 'issued_on' => now()->subDays(4)->toDateString(), 'due_on' => now()->addDays(10)->toDateString(), 'notes' => 'Harbor discovery installment.', 'internal_notes' => 'Internal: do not show the cost rate.']);
        Invoice::query()->create(['organization_id' => $studio->id, 'project_id' => $identity->id, 'client_company_id' => $kite->id, 'number' => 'INV-1048', 'amount_cents' => 150000, 'status' => InvoiceStatus::Voided, 'client_visible' => false, 'issued_on' => now()->subDays(1)->toDateString(), 'notes' => 'Voided draft.', 'internal_notes' => 'Replaced before it was shared.']);

        AppNotification::query()->create(['organization_id' => $studio->id, 'user_id' => $camille->id, 'type' => 'deliverable', 'dedupe_key' => 'seed-deliverable-tasting', 'title' => 'Deliverable ready for review', 'body' => '“Tasting film cut” version 1 is ready for your review.']);
        AppNotification::query()->create(['organization_id' => $studio->id, 'user_id' => $priya->id, 'type' => 'assignment', 'dedupe_key' => 'seed-assigned-labels', 'title' => 'Task assigned', 'body' => 'You were assigned “Draw the label system” on Harbor packaging refresh.']);
        OutboundMessage::query()->create(['user_id' => $camille->id, 'email' => $camille->email, 'dedupe_key' => 'seed-deliverable-tasting', 'subject' => 'Deliverable ready for review', 'body' => '“Tasting film cut” version 1 is ready for your review.', 'status' => 'queued']);

        Activity::query()->create(['organization_id' => $studio->id, 'actor_id' => $ada->id, 'event' => 'platform.noted', 'summary' => 'Platform admin Ada can see agencies and nothing inside a client project.', 'client_visible' => false]);
    }

    private function person(string $name, string $email, bool $platform = false): User
    {
        return User::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => 'password',
            'email_verified_at' => now(),
            'is_platform_admin' => $platform,
        ]);
    }

    private function join(Organization $organization, User $user, MembershipRole $role, ?ClientCompany $company = null): void
    {
        Membership::query()->create([
            'organization_id' => $organization->id,
            'user_id' => $user->id,
            'role' => $role,
            'client_company_id' => $company?->id,
        ]);
    }

    private function project(Organization $organization, ClientCompany $company, User $manager, string $name, string $reference, ProjectStatus $status, ProjectPriority $priority, \DateTimeInterface $due, int $budget, int $fee, bool $feeVisible): Project
    {
        return Project::query()->create([
            'organization_id' => $organization->id,
            'client_company_id' => $company->id,
            'project_manager_id' => $manager->id,
            'name' => $name,
            'reference' => $reference,
            'description' => $name.' for a fictional engagement.',
            'scope' => 'Design, review, and a recorded client decision.',
            'status' => $status,
            'priority' => $priority,
            'start_date' => now()->subDays(14)->toDateString(),
            'due_date' => $due,
            'budget_cents' => $budget,
            'agreed_fee_cents' => $fee,
            'fee_visible_to_client' => $feeVisible,
        ]);
    }

    private function task(Project $project, ?Milestone $milestone, User $creator, User $assignee, string $title, TaskStatus $status, bool $visible, \DateTimeInterface $due, ?float $hours = null, ?int $prerequisite = null, ?int $parent = null): Task
    {
        return Task::query()->create([
            'project_id' => $project->id,
            'milestone_id' => $milestone?->id,
            'parent_id' => $parent,
            'prerequisite_task_id' => $prerequisite,
            'title' => $title,
            'assignee_id' => $assignee->id,
            'creator_id' => $creator->id,
            'status' => $status,
            'priority' => TaskPriority::Normal,
            'due_date' => $due,
            'estimate_hours' => $hours,
            'client_visible' => $visible,
        ]);
    }
}
