<?php

namespace App\Models;

use App\Enums\InvoiceStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['organization_id', 'project_id', 'client_company_id', 'number', 'amount_cents', 'status', 'client_visible', 'issued_on', 'due_on', 'notes', 'internal_notes'])]
class Invoice extends Model
{
    protected function casts(): array
    {
        return [
            'amount_cents' => 'integer',
            'status' => InvoiceStatus::class,
            'client_visible' => 'boolean',
            'issued_on' => 'date',
            'due_on' => 'date',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function clientCompany(): BelongsTo
    {
        return $this->belongsTo(ClientCompany::class);
    }
}
