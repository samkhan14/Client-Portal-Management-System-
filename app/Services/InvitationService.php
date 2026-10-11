<?php

namespace App\Services;

use App\Enums\MembershipRole;
use App\Models\Invitation;
use App\Models\Membership;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class InvitationService
{
    public const GENERIC_MESSAGE = 'If this address can receive an invitation, it has been issued.';

    public const INVALID_MESSAGE = 'This invitation is no longer valid.';

    public function __construct(private NotificationWriter $notifications, private ActivityLogger $activities) {}

    public function issue(User $actor, int $organizationId, string $email, MembershipRole $role, ?int $clientCompanyId): void
    {
        $email = mb_strtolower(trim($email));
        $alreadyMember = Membership::query()->where('organization_id', $organizationId)->whereHas('user', fn ($query) => $query->where('email', $email))->exists();
        if ($alreadyMember) {
            return;
        }
        if ($role->isClient() && ! $clientCompanyId) {
            throw ValidationException::withMessages(['client_company_id' => 'Choose the client company for this invitation.']);
        }

        $plain = Str::random(64);
        DB::transaction(function () use ($actor, $organizationId, $email, $role, $clientCompanyId, $plain): void {
            Invitation::query()->where('organization_id', $organizationId)->where('email', $email)->whereNull('accepted_at')->whereNull('revoked_at')->update(['revoked_at' => now()]);
            $invitation = Invitation::query()->create([
                'organization_id' => $organizationId,
                'email' => $email,
                'role' => $role,
                'client_company_id' => $role->isClient() ? $clientCompanyId : null,
                'token_hash' => hash('sha256', $plain),
                'expires_at' => now()->addDays(7),
                'invited_by' => $actor->id,
            ]);
            $existing = User::query()->where('email', $email)->first();
            $this->notifications->queueEmail($existing?->id, $email, 'invitation:'.$invitation->id, 'You are invited to Northline', "Use this single-use link within 7 days:\n".url('/invitations/'.$plain));
            if ($existing) {
                $this->notifications->send($existing, $organizationId, 'invitation', 'invitation-notice:'.$invitation->id, 'Agency invitation', 'You have an invitation waiting. Open the link in your queued message to accept it.');
            }
            $this->activities->log($organizationId, null, $actor, 'invitation.created', 'An invitation was issued.', false);
        });
    }

    public function revoke(Invitation $invitation, User $actor): void
    {
        DB::transaction(function () use ($invitation, $actor): void {
            $locked = Invitation::query()->whereKey($invitation->id)->lockForUpdate()->firstOrFail();
            if ($locked->accepted_at || $locked->revoked_at) {
                throw ValidationException::withMessages(['invitation' => self::INVALID_MESSAGE]);
            }
            $locked->revoked_at = now();
            $locked->save();
            $this->activities->log($locked->organization_id, null, $actor, 'invitation.revoked', 'An invitation was revoked.', false);
        });
    }

    public function findUsable(string $plainToken): ?Invitation
    {
        $invitation = Invitation::query()->where('token_hash', hash('sha256', $plainToken))->first();

        return $invitation && $invitation->isUsable() ? $invitation : null;
    }

    /** @param array{name?: string, password?: string} $credentials */
    public function accept(string $plainToken, ?User $actor, array $credentials): User
    {
        return DB::transaction(function () use ($plainToken, $actor, $credentials) {
            $invitation = Invitation::query()->where('token_hash', hash('sha256', $plainToken))->lockForUpdate()->first();
            if (! $invitation || ! $invitation->isUsable()) {
                throw ValidationException::withMessages(['invitation' => self::INVALID_MESSAGE]);
            }
            $user = User::query()->where('email', mb_strtolower($invitation->email))->first();
            if ($user) {
                if (! $actor || $actor->id !== $user->id) {
                    throw ValidationException::withMessages(['invitation' => 'Sign in with the invited email address, then open the invitation again.']);
                }
            } else {
                $name = trim((string) ($credentials['name'] ?? ''));
                $password = (string) ($credentials['password'] ?? '');
                if ($name === '' || strlen($password) < 8) {
                    throw ValidationException::withMessages(['name' => 'Enter your name and a password of at least 8 characters.']);
                }
                $user = User::query()->create(['name' => $name, 'email' => mb_strtolower($invitation->email), 'password' => $password, 'email_verified_at' => now()]);
            }
            Membership::query()->firstOrCreate(
                ['organization_id' => $invitation->organization_id, 'user_id' => $user->id],
                ['role' => $invitation->role, 'client_company_id' => $invitation->client_company_id],
            );
            $invitation->accepted_at = now();
            $invitation->save();
            $this->activities->log($invitation->organization_id, null, $user, 'invitation.accepted', 'An invitation was accepted.', false);

            return $user;
        });
    }
}
