<?php

namespace App\Enums;

enum TaskStatus: string
{
    case Todo = 'TODO';
    case InProgress = 'IN_PROGRESS';
    case Blocked = 'BLOCKED';
    case InReview = 'IN_REVIEW';
    case Done = 'DONE';

    public function label(): string
    {
        return match ($this) {
            self::Todo => 'To do',
            self::InProgress => 'In progress',
            self::Blocked => 'Blocked',
            self::InReview => 'In review',
            self::Done => 'Done',
        };
    }

    public function clientLabel(): string
    {
        return $this === self::Todo ? 'Not started' : $this->label();
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Todo => [self::InProgress, self::Blocked],
            self::InProgress => [self::Blocked, self::InReview, self::Todo],
            self::Blocked => [self::Todo, self::InProgress],
            self::InReview => [self::InProgress, self::Done],
            self::Done => [self::InProgress],
        };
    }

    public function canTransitionTo(self $next): bool
    {
        return in_array($next, $this->allowedTransitions(), true);
    }
}
