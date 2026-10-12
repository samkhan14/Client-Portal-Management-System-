<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateNotificationPreferenceRequest;
use App\Models\AppNotification;
use App\Models\NotificationPreference;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    public function index(Request $request): Response
    {
        $notifications = AppNotification::query()->where('user_id', $request->user()->id)->latest()->paginate(20)->withQueryString();

        return Inertia::render('Notifications/Index', [
            'notifications' => [
                'data' => $notifications->getCollection()->map(fn (AppNotification $notification) => [
                    'id' => $notification->id,
                    'title' => $notification->title,
                    'body' => $notification->body,
                    'type' => $notification->type,
                    'read_at' => $notification->read_at?->toIso8601String(),
                    'created_at' => $notification->created_at?->toIso8601String(),
                ])->values(),
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
                'total' => $notifications->total(),
            ],
        ]);
    }

    public function read(Request $request, AppNotification $notification): RedirectResponse
    {
        abort_unless((int) $notification->user_id === $request->user()->id, 404);
        $notification->forceFill(['read_at' => now()])->save();

        return back();
    }

    public function readAll(Request $request): RedirectResponse
    {
        AppNotification::query()->where('user_id', $request->user()->id)->whereNull('read_at')->update(['read_at' => now()]);

        return back();
    }

    public function updatePreferences(UpdateNotificationPreferenceRequest $request): RedirectResponse
    {
        NotificationPreference::query()->updateOrCreate(['user_id' => $request->user()->id], $request->validated());

        return back()->with('success', 'Notification preferences saved.');
    }
}
