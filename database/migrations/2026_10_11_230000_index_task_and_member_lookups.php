<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->index(['project_id', 'title'], 'tasks_project_title_index');
        });

        Schema::table('memberships', function (Blueprint $table) {
            $table->index(['organization_id', 'client_company_id'], 'memberships_organization_client_index');
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropIndex('tasks_project_title_index');
        });

        Schema::table('memberships', function (Blueprint $table) {
            $table->dropIndex('memberships_organization_client_index');
        });
    }
};
