<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Models\Invitation;
use App\Models\OutboundMessage;
use App\Models\User;
use App\Services\InvitationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\CreatesAgency;
use Tests\TestCase;

class InvitationTest extends TestCase
{
    use CreatesAgency, RefreshDatabase;

    public function test_invitations_are_generic_hashed_expiring_and_single_use(): void
    {
        $org = $this->makeOrg();
        $company = $this->makeCompany($org, 'Brightwater');
        $owner = $this->makeUser('Mara Ellison');
        $pm = $this->makeUser('Jonah Hale');
        $existing = $this->makeUser('Already Member');
        $this->join($owner, $org, MembershipRole::AgencyOwner);
        $this->join($pm, $org, MembershipRole::ProjectManager);
        $this->join($existing, $org, MembershipRole::TeamMember);

        $this->actingAs($owner)->post(route('invitations.store'), [
            'email' => $existing->email,
            'role' => 'TEAM_MEMBER',
        ])->assertRedirect()->assertSessionHas('success', InvitationService::GENERIC_MESSAGE);
        $this->assertSame(0, Invitation::query()->count());

        $this->actingAs($owner)->from(route('team.index'))->post(route('invitations.store'), [
            'email' => 'New.Person@Example.TEST',
            'role' => 'CLIENT_COLLABORATOR',
            'client_company_id' => $company->id,
        ])->assertRedirect()->assertSessionHas('success', InvitationService::GENERIC_MESSAGE);

        $invitation = Invitation::query()->firstOrFail();
        $message = OutboundMessage::query()->where('email', 'new.person@example.test')->firstOrFail();
        preg_match('#/invitations/([A-Za-z0-9]+)#', $message->body, $matches);
        $token = $matches[1];
        $this->assertNotSame($token, $invitation->token_hash);
        $this->assertSame(hash('sha256', $token), $invitation->token_hash);

        $this->post(route('logout'));
        $this->post('/invitations/'.$token, ['name' => 'New Person', 'password' => 'password1'])->assertRedirect(route('portal.home'));
        $this->assertAuthenticated();
        $this->assertNotNull($invitation->fresh()->accepted_at);

        $this->post('/invitations/'.$token, ['name' => 'New Person', 'password' => 'password1'])->assertSessionHasErrors('invitation');
        $this->assertSame(1, User::query()->where('email', 'new.person@example.test')->count());

        $this->actingAs($owner)->post(route('invitations.store'), [
            'email' => 'later@example.test',
            'role' => 'TEAM_MEMBER',
        ])->assertSessionHas('success', InvitationService::GENERIC_MESSAGE);
        $later = OutboundMessage::query()->where('email', 'later@example.test')->firstOrFail();
        preg_match('#/invitations/([A-Za-z0-9]+)#', $later->body, $laterMatch);
        $laterInvite = Invitation::query()->where('email', 'later@example.test')->firstOrFail();
        $laterInvite->forceFill(['expires_at' => now()->subMinute()])->save();
        $this->post('/invitations/'.$laterMatch[1], ['name' => 'Late', 'password' => 'password1'])->assertSessionHasErrors('invitation');

        $this->actingAs($owner)->post(route('invitations.store'), [
            'email' => 'revoke@example.test',
            'role' => 'TEAM_MEMBER',
        ]);
        $revokeMessage = OutboundMessage::query()->where('email', 'revoke@example.test')->firstOrFail();
        preg_match('#/invitations/([A-Za-z0-9]+)#', $revokeMessage->body, $revokeMatch);
        $revokeInvite = Invitation::query()->where('email', 'revoke@example.test')->firstOrFail();
        $this->actingAs($owner)->post(route('invitations.revoke', $revokeInvite))->assertRedirect();
        $this->post('/invitations/'.$revokeMatch[1], ['name' => 'Revoked', 'password' => 'password1'])->assertSessionHasErrors('invitation');

        $this->actingAs($pm)->post(route('invitations.store'), [
            'email' => 'boss@example.test',
            'role' => 'AGENCY_OWNER',
        ])->assertSessionHasErrors('role');
    }
}
