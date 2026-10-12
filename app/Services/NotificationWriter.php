<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\NotificationPreference;
use App\Models\OutboundMessage;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;

class NotificationWriter
{
    public function send(User $user, ?int $organizationId, string $type, string $dedupeKey, string $title, string $body): void
    {
        $preference = NotificationPreference::query()->firstOrCreate(['user_id' => $user->id]);
        if (! $preference->allows($type)) {
            return;
        }

        $this->once(fn () => AppNotification::query()->create([
            'organization_id' => $organizationId,
            'user_id' => $user->id,
            'type' => $type,
            'dedupe_key' => $dedupeKey,
            'title' => $title,
            'body' => $body,
        ]));

        $this->queueEmail($user->id, $user->email, $dedupeKey, $title, $body);
    }

    public function queueEmail(?int $userId, string $email, string $dedupeKey, string $subject, string $body): void
    {
        $this->once(fn () => OutboundMessage::query()->create([
            'user_id' => $userId,
            'email' => $email,
            'dedupe_key' => $dedupeKey,
            'subject' => $subject,
            'body' => $body,
            'status' => 'queued',
        ]));
    }

    private function once(callable $callback): void
    {
        try {
            $callback();
        } catch (UniqueConstraintViolationException) {
            //
        }
    }
}
