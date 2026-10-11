<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organizations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->unsignedInteger('hourly_rate_cents')->default(0);
            $table->string('timezone', 64)->default('America/New_York');
            $table->timestamps();
        });

        Schema::create('client_companies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->string('website')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['organization_id', 'slug']);
        });

        Schema::create('memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 32);
            $table->foreignId('client_company_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
            $table->unique(['organization_id', 'user_id']);
            $table->index(['organization_id', 'role']);
        });

        Schema::create('contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_company_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('title')->nullable();
            $table->timestamps();
        });

        Schema::create('onboarding_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_company_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('detail')->nullable();
            $table->boolean('is_complete')->default(false);
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('email');
            $table->string('role', 32);
            $table->foreignId('client_company_id')->nullable()->constrained()->nullOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->foreignId('invited_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->index(['organization_id', 'email']);
        });

        Schema::create('notification_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('assignments')->default(true);
            $table->boolean('due_soon')->default(true);
            $table->boolean('comments')->default(true);
            $table->boolean('deliverables')->default(true);
            $table->boolean('status_changes')->default(true);
            $table->boolean('invitations')->default(true);
            $table->timestamps();
        });

        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('client_company_id')->constrained()->restrictOnDelete();
            $table->string('name');
            $table->string('reference', 40);
            $table->text('description')->nullable();
            $table->text('scope')->nullable();
            $table->foreignId('project_manager_id')->constrained('users')->restrictOnDelete();
            $table->string('status', 32);
            $table->string('priority', 16)->default('NORMAL');
            $table->date('start_date')->nullable();
            $table->date('due_date')->nullable();
            $table->unsignedBigInteger('budget_cents')->nullable();
            $table->unsignedBigInteger('agreed_fee_cents')->nullable();
            $table->boolean('fee_visible_to_client')->default(false);
            $table->text('outstanding_request')->nullable();
            $table->timestamps();
            $table->unique(['organization_id', 'reference']);
            $table->index(['organization_id', 'status']);
            $table->index('due_date');
        });

        Schema::create('project_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['project_id', 'user_id']);
        });

        Schema::create('milestones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->date('due_date')->nullable();
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
            $table->index(['project_id', 'due_date']);
        });

        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('milestone_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('tasks')->cascadeOnDelete();
            $table->foreignId('prerequisite_task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('creator_id')->constrained('users')->restrictOnDelete();
            $table->string('status', 32)->default('TODO');
            $table->string('priority', 16)->default('NORMAL');
            $table->date('start_date')->nullable();
            $table->date('due_date')->nullable();
            $table->decimal('estimate_hours', 8, 2)->nullable();
            $table->boolean('client_visible')->default(false);
            $table->timestamps();
            $table->index(['project_id', 'status']);
            $table->index(['assignee_id', 'due_date']);
        });

        Schema::create('task_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            $table->string('from_status', 32)->nullable();
            $table->string('to_status', 32);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by')->constrained('users')->restrictOnDelete();
            $table->string('disk', 32)->default('local');
            $table->string('path');
            $table->string('original_name');
            $table->string('mime', 127);
            $table->unsignedBigInteger('size');
            $table->boolean('client_visible')->default(false);
            $table->timestamps();
            $table->index(['project_id', 'client_visible']);
        });

        Schema::create('deliverables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('deliverable_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('deliverable_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version_number');
            $table->string('status', 32);
            $table->text('summary')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->text('decision_note')->nullable();
            $table->timestamps();
            $table->unique(['deliverable_id', 'version_number']);
            $table->index('status');
        });

        Schema::create('comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('task_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('deliverable_version_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->text('body');
            $table->boolean('client_visible')->default(false);
            $table->foreignId('file_id')->nullable()->constrained('files')->nullOnDelete();
            $table->timestamps();
            $table->index(['project_id', 'client_visible']);
        });

        Schema::create('activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event', 64);
            $table->string('summary', 500);
            $table->boolean('client_visible')->default(false);
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->timestamps();
            $table->index(['project_id', 'client_visible', 'created_at']);
        });

        Schema::create('app_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 64);
            $table->string('dedupe_key', 191);
            $table->string('title');
            $table->text('body');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'dedupe_key']);
            $table->index(['user_id', 'read_at']);
        });

        Schema::create('outbound_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('email');
            $table->string('dedupe_key', 191);
            $table->string('subject');
            $table->text('body');
            $table->string('status', 32)->default('queued');
            $table->timestamps();
            $table->unique(['email', 'dedupe_key']);
        });

        Schema::create('time_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('task_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('minutes');
            $table->date('work_date');
            $table->text('note')->nullable();
            $table->timestamps();
            $table->index(['project_id', 'work_date']);
        });

        Schema::create('change_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requested_by')->constrained('users')->restrictOnDelete();
            $table->string('title');
            $table->text('description');
            $table->string('status', 32)->default('OPEN');
            $table->text('decision_note')->nullable();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('client_company_id')->constrained()->restrictOnDelete();
            $table->string('number', 40);
            $table->unsignedBigInteger('amount_cents');
            $table->string('status', 16)->default('UNPAID');
            $table->boolean('client_visible')->default(false);
            $table->date('issued_on');
            $table->date('due_on')->nullable();
            $table->text('notes')->nullable();
            $table->text('internal_notes')->nullable();
            $table->timestamps();
            $table->unique(['organization_id', 'number']);
            $table->index(['organization_id', 'status']);
        });
    }

    public function down(): void
    {
        foreach ([
            'invoices', 'change_requests', 'time_entries', 'outbound_messages', 'app_notifications',
            'activities', 'comments', 'deliverable_versions', 'deliverables', 'files',
            'task_status_histories', 'tasks', 'milestones', 'project_members', 'projects',
            'notification_preferences', 'invitations', 'onboarding_items', 'contacts',
            'memberships', 'client_companies', 'organizations',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
