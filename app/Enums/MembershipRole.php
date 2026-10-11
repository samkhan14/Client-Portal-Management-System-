<?php

namespace App\Enums;

enum MembershipRole: string
{
    case AgencyOwner = 'AGENCY_OWNER';
    case ProjectManager = 'PROJECT_MANAGER';
    case TeamMember = 'TEAM_MEMBER';
    case ClientAdmin = 'CLIENT_ADMIN';
    case ClientCollaborator = 'CLIENT_COLLABORATOR';
    case ReadOnly = 'READ_ONLY';

    public function isStaff(): bool
    {
        return match ($this) {
            self::AgencyOwner, self::ProjectManager, self::TeamMember => true,
            default => false,
        };
    }

    public function isClient(): bool
    {
        return match ($this) {
            self::ClientAdmin, self::ClientCollaborator, self::ReadOnly => true,
            default => false,
        };
    }

    public function canManageProjects(): bool
    {
        return $this === self::AgencyOwner || $this === self::ProjectManager;
    }

    public function canManageOrganization(): bool
    {
        return $this === self::AgencyOwner;
    }

    public function label(): string
    {
        return match ($this) {
            self::AgencyOwner => 'Agency owner',
            self::ProjectManager => 'Project manager',
            self::TeamMember => 'Team member',
            self::ClientAdmin => 'Client admin',
            self::ClientCollaborator => 'Collaborator',
            self::ReadOnly => 'Read only',
        };
    }

    /** @return list<self> */
    public static function invitableBy(self $actor): array
    {
        return match ($actor) {
            self::AgencyOwner => [self::AgencyOwner, self::ProjectManager, self::TeamMember, self::ClientAdmin, self::ClientCollaborator, self::ReadOnly],
            self::ProjectManager => [self::TeamMember, self::ClientCollaborator, self::ReadOnly],
            default => [],
        };
    }
}
