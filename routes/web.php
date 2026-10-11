<?php

use App\Http\Controllers\Admin\OrganizationController;
use App\Http\Controllers\Auth\AcceptInvitationController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\FileController;
use App\Http\Controllers\Internal\ChangeRequestController;
use App\Http\Controllers\Internal\ClientCompanyController;
use App\Http\Controllers\Internal\CommentController;
use App\Http\Controllers\Internal\DashboardController;
use App\Http\Controllers\Internal\DeliverableController;
use App\Http\Controllers\Internal\InvoiceController;
use App\Http\Controllers\Internal\MilestoneController;
use App\Http\Controllers\Internal\ProjectController;
use App\Http\Controllers\Internal\SettingsController;
use App\Http\Controllers\Internal\TaskController;
use App\Http\Controllers\Internal\TeamController;
use App\Http\Controllers\Internal\TimeEntryController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\Portal\DeliverableDecisionController;
use App\Http\Controllers\Portal\HomeController;
use App\Http\Controllers\Portal\ProjectController as PortalProjectController;
use App\Http\Controllers\ThemeController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/login', [LoginController::class, 'create'])->name('login');
    Route::post('/login', [LoginController::class, 'store']);
});

Route::get('/invitations/{token}', [AcceptInvitationController::class, 'create'])->name('invitations.accept');
Route::post('/invitations/{token}', [AcceptInvitationController::class, 'store']);
Route::post('/theme', [ThemeController::class, 'update'])->name('theme.update');

Route::middleware('auth')->group(function () {
    Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');

    Route::middleware('platform')->prefix('admin')->group(function () {
        Route::get('/organizations', [OrganizationController::class, 'index'])->name('admin.organizations.index');
    });

    Route::middleware('member')->group(function () {
        Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
        Route::post('/notifications/read-all', [NotificationController::class, 'readAll'])->name('notifications.read-all');
        Route::post('/notifications/{notification}/read', [NotificationController::class, 'read'])->name('notifications.read');
        Route::put('/notification-preferences', [NotificationController::class, 'updatePreferences'])->name('notification-preferences.update');
        Route::get('/files/{storedFile}/download', [FileController::class, 'download'])->name('files.download');
        Route::delete('/files/{storedFile}', [FileController::class, 'destroy'])->name('files.destroy');

        Route::middleware('staff')->scopeBindings()->group(function () {
            Route::get('/', DashboardController::class)->name('dashboard');
            Route::get('/projects', [ProjectController::class, 'index'])->name('projects.index');
            Route::get('/projects/create', [ProjectController::class, 'create'])->name('projects.create');
            Route::post('/projects', [ProjectController::class, 'store'])->name('projects.store');
            Route::get('/projects/{project}', [ProjectController::class, 'show'])->name('projects.show');
            Route::get('/projects/{project}/edit', [ProjectController::class, 'edit'])->name('projects.edit');
            Route::put('/projects/{project}', [ProjectController::class, 'update'])->name('projects.update');
            Route::post('/projects/{project}/status', [ProjectController::class, 'transition'])->name('projects.status');
            Route::put('/projects/{project}/members', [ProjectController::class, 'syncMembers'])->name('projects.members.sync');

            Route::post('/projects/{project}/milestones', [MilestoneController::class, 'store'])->name('milestones.store');
            Route::put('/projects/{project}/milestones/{milestone}', [MilestoneController::class, 'update'])->name('milestones.update');
            Route::delete('/projects/{project}/milestones/{milestone}', [MilestoneController::class, 'destroy'])->name('milestones.destroy');

            Route::get('/tasks', [TaskController::class, 'index'])->name('tasks.index');
            Route::post('/projects/{project}/tasks', [TaskController::class, 'store'])->name('tasks.store');
            Route::put('/projects/{project}/tasks/{task}', [TaskController::class, 'update'])->name('tasks.update');
            Route::post('/projects/{project}/tasks/{task}/status', [TaskController::class, 'transition'])->name('tasks.status');

            Route::post('/projects/{project}/comments', [CommentController::class, 'store'])->name('comments.store');
            Route::post('/projects/{project}/files', [FileController::class, 'store'])->name('files.store');

            Route::post('/projects/{project}/deliverables', [DeliverableController::class, 'store'])->name('deliverables.store');
            Route::post('/projects/{project}/deliverables/{deliverable}/versions', [DeliverableController::class, 'newVersion'])->name('deliverables.versions.store');
            Route::put('/deliverable-versions/{version}', [DeliverableController::class, 'updateDraft'])->name('deliverables.draft');
            Route::post('/deliverable-versions/{version}/submit', [DeliverableController::class, 'submit'])->name('deliverables.submit');

            Route::post('/projects/{project}/time-entries', [TimeEntryController::class, 'store'])->name('time-entries.store');
            Route::post('/projects/{project}/change-requests', [ChangeRequestController::class, 'store'])->name('change-requests.store');
            Route::post('/change-requests/{changeRequest}/decide', [ChangeRequestController::class, 'decide'])->name('change-requests.decide');

            Route::get('/invoices', [InvoiceController::class, 'index'])->name('invoices.index');
            Route::post('/invoices', [InvoiceController::class, 'store'])->name('invoices.store');
            Route::put('/invoices/{invoice}', [InvoiceController::class, 'update'])->name('invoices.update');

            Route::get('/clients', [ClientCompanyController::class, 'index'])->name('clients.index');
            Route::post('/clients', [ClientCompanyController::class, 'store'])->name('clients.store');
            Route::get('/clients/{clientCompany}', [ClientCompanyController::class, 'show'])->name('clients.show');
            Route::put('/clients/{clientCompany}', [ClientCompanyController::class, 'update'])->name('clients.update');
            Route::post('/clients/{clientCompany}/contacts', [ClientCompanyController::class, 'storeContact'])->name('contacts.store');
            Route::delete('/contacts/{contact}', [ClientCompanyController::class, 'destroyContact'])->name('contacts.destroy');
            Route::post('/clients/{clientCompany}/onboarding', [ClientCompanyController::class, 'storeOnboarding'])->name('onboarding.store');
            Route::post('/onboarding/{onboardingItem}/toggle', [ClientCompanyController::class, 'toggleOnboarding'])->name('onboarding.toggle');

            Route::get('/team', [TeamController::class, 'index'])->name('team.index');
            Route::post('/invitations', [TeamController::class, 'storeInvitation'])->name('invitations.store');
            Route::post('/invitations/{invitation}/revoke', [TeamController::class, 'revokeInvitation'])->name('invitations.revoke');
            Route::put('/memberships/{membership}', [TeamController::class, 'updateMembership'])->name('memberships.update');
            Route::delete('/memberships/{membership}', [TeamController::class, 'destroyMembership'])->name('memberships.destroy');

            Route::get('/settings', [SettingsController::class, 'edit'])->name('settings.edit');
            Route::put('/settings', [SettingsController::class, 'update'])->name('settings.update');
        });

        Route::middleware('client')->prefix('portal')->scopeBindings()->group(function () {
            Route::get('/', HomeController::class)->name('portal.home');
            Route::get('/projects/{project}', [PortalProjectController::class, 'show'])->name('portal.projects.show');
            Route::post('/projects/{project}/comments', [PortalProjectController::class, 'comment'])->name('portal.comments.store');
            Route::post('/projects/{project}/files', [PortalProjectController::class, 'upload'])->name('portal.files.store');
            Route::post('/projects/{project}/change-requests', [PortalProjectController::class, 'changeRequest'])->name('portal.change-requests.store');
            Route::post('/deliverable-versions/{version}/approve', [DeliverableDecisionController::class, 'approve'])->name('deliverables.approve');
            Route::post('/deliverable-versions/{version}/changes', [DeliverableDecisionController::class, 'requestChanges'])->name('deliverables.changes');
        });
    });
});
