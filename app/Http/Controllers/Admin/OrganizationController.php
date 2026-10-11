<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use Inertia\Inertia;
use Inertia\Response;

class OrganizationController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Organizations', [
            'organizations' => Organization::query()->orderBy('name')->get(['id', 'name', 'slug']),
        ]);
    }
}
