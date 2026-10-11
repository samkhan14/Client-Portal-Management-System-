<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Services\DashboardQuery;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(DashboardQuery $dashboard): Response
    {
        return Inertia::render('Internal/Dashboard', [
            'summary' => $dashboard->forUser(request()->user()),
        ]);
    }
}
