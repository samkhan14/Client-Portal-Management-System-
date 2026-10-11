<?php

namespace App\Enums;

enum ProjectStatus: string
{
    case Planning = 'PLANNING';
    case InProgress = 'IN_PROGRESS';
    case WaitingOnClient = 'WAITING_ON_CLIENT';
    case OnHold = 'ON_HOLD';
    case Completed = 'COMPLETED';
    case Cancelled = 'CANCELLED';

    public function label(): string
    {
        return match ($this) {
            self::Planning => 'Planning',
            self::InProgress => 'In progress',
            self::WaitingOnClient => 'Waiting on client',
            self::OnHold => 'On hold',
            self::Completed => 'Completed',
            self::Cancelled => 'Cancelled',
        };
    }

    public function clientLabel(): string
    {
        return match ($this) {
            self::WaitingOnClient => 'Waiting on you',
            self::Completed => 'Complete',
            default => $this->label(),
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Planning => [self::InProgress, self::OnHold, self::Cancelled],
            self::InProgress => [self::WaitingOnClient, self::OnHold, self::Completed, self::Cancelled],
            self::WaitingOnClient => [self::InProgress, self::OnHold, self::Cancelled],
            self::OnHold => [self::Planning, self::InProgress, self::Cancelled],
            self::Completed, self::Cancelled => [],
        };
    }

    public function canTransitionTo(self $next): bool
    {
        return in_array($next, $this->allowedTransitions(), true);
    }
}
