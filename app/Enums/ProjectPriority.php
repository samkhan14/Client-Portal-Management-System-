<?php

namespace App\Enums;

enum ProjectPriority: string
{
    case Low = 'LOW';
    case Normal = 'NORMAL';
    case High = 'HIGH';
    case Urgent = 'URGENT';

    public function label(): string
    {
        return ucfirst(strtolower($this->name));
    }
}
