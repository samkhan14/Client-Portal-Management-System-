# Northline

Northline is a client portal and project delivery workspace for an agency. Internal staff run the work. Clients from each company see only what was explicitly shared with them.

## Stack

- **Next.js (App Router) + React + TypeScript** on Node. One web app owns the UI, server actions, and route handlers. There is no separate API service.
- **PostgreSQL + Prisma.** The schema is relational, with foreign keys, unique constraints, and indexes checked in under `prisma/migrations`.
- **Auth.** Email and password hashed with bcrypt. The session id is a random token stored only as a SHA-256 hash. The cookie is HTTP-only, `SameSite=Lax`, and `Secure` in production. Mutating route handlers require a same-origin `Origin` and a CSRF token that matches the session. Server actions require the same token in the form.
- **Authorization.** Every read and mutation goes through an actor (organization membership + role) and a project visibility filter. Hiding a button is not the control.
- **Tailwind CSS.** A small set of form, badge, and shell components.
- **Files.** Bytes live in `storage/uploads` (not `public`). Metadata lives in Postgres. Downloads go through `GET /api/files/[id]`, which checks the organization and the client-visibility flag.
- **Email.** No SMTP provider. Important events insert `Notification` rows for `IN_APP` and `EMAIL`. Email rows start `PENDING` (or `SKIPPED` when the organization turns the queue off) and a no-op logger marks a claimed row `SENT`. The dedupe key is unique, so retries do not insert a second job.

## Tenancy and roles

`Organization` is the agency. `ClientCompany` belongs to that organization. `User` is global (unique email). `Membership` links a user to one organization with one role, and client roles also point at a client company. `ProjectMember` links a user to a project.

| Role | Access |
| --- | --- |
| `PLATFORM_ADMIN` | Can list organizations. Not part of delivery. |
| `AGENCY_OWNER` | Organization settings, people, invitations, every project, fees, invoices. |
| `PROJECT_MANAGER` | Every project in the agency, tasks, deliverables, project budget, invoices. Cannot change organization settings or invite an owner. |
| `TEAM_MEMBER` | Projects they are a member of. Can update tasks assigned to them, comment, upload, and log their own time. They see task estimates, not the project internal estimate. |
| `CLIENT_ADMIN` | Every project for their client company. Can comment and approve deliverables. |
| `CLIENT_COLLABORATOR` | Only projects they are a member of, inside their company. Can comment. Cannot approve. |
| `READ_ONLY` | Same project list as a collaborator. View only. |

Project managers see every project in the agency, not only projects they are assigned to. Client admins see every project for their company even when they are not a project member. Collaborators and read-only stakeholders must be project members.

Clients never receive internal notes, staff-only files, internal comments, time entries, internal estimates, or invoices and fees that are not marked client-visible. Assignment activity is internal. A client-visible activity row never includes internal-only body text.

Revoking a membership sets `revokedAt` and revokes that user’s sessions for the organization. The next request no longer resolves an actor.

## Core journey

Client onboarding (company, contacts, checklist, invitation) → project → milestones → tasks → updates → deliverable draft → submit → client admin approves or requests changes → a new version is created instead of overwriting → project can be marked completed.

Project status changes are limited to owners and project managers. `WAITING_ON_CLIENT` requires a client-visible outstanding request. Allowed transitions:

- Planning → In progress, On hold, Cancelled
- In progress → Waiting on client, On hold, Completed, Cancelled, Planning
- Waiting on client → In progress, On hold, Completed, Cancelled
- On hold → Planning, In progress, Cancelled
- Completed → In progress
- Cancelled → Planning

Deliverable versions move `DRAFT → SUBMITTED → APPROVED` or `CHANGES_REQUESTED`. The decision is a conditional update (`status = SUBMITTED`), so a second or concurrent decision fails and the first record stays. This is an audit trail, not an e-signature.

## Progress

Project progress is `completed milestones / total milestones`, computed in SQL.

A milestone is complete only when it has at least one task and every task on it (including one-level subtasks) is `DONE`. A milestone with no tasks is not complete. A project with no milestones is 0%. Task done/total counts are returned beside that percentage. The browser does not add this up from a full table load.

## How to run

PostgreSQL 16 is required. Copy the example env and point it at a local database:

```bash
cp .env.example .env
```

Example local URLs (do not commit `.env`):

```bash
DATABASE_URL="postgresql://portal:portal@127.0.0.1:5432/portal?schema=public"
TEST_DATABASE_URL="postgresql://portal:portal@127.0.0.1:5432/portal_test?schema=public"
```

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Seed resets the **development** database and prints a demo invitation link. It refuses to run against `portal_test`.

Every seeded user uses the password `Password123!`.

| Email | Role |
| --- | --- |
| owner@northline.test | Agency owner |
| pm@northline.test | Project manager |
| member@northline.test | Team member |
| ada@acme.test | Acme client admin |
| cole@acme.test | Acme collaborator |
| rory@acme.test | Acme read-only |
| gina@globex.test | Globex client admin (separate company) |
| platform@northline.test | Platform admin |
| owner@harbor.test | Owner of a second agency |

Open invitation after seeding: `/invite/northline-demo-invite-token`

Deadline scan (no cron daemon):

```bash
npm run notifications:scan
```

Owners and project managers can also run “Check approaching deadlines” from Notifications.

## Tests

Vitest uses `portal_test` and applies the checked-in migrations. It will not truncate a URL that does not contain `portal_test`.

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Security notes

- Passwords are bcrypt hashes. Session and invitation tokens are stored as SHA-256 hashes. Invitation links are shown once to the inviter because email is not delivered.
- Invitation errors do not say whether an arbitrary address already has an account. A valid token is different: the invited address is shown to the token holder.
- Queries that load a project, file, comment, invoice, or notification always include the actor’s organization and visibility. Missing and forbidden resources return “Not found” when revealing existence would cross a tenant boundary.
- Role and organization id are taken from the session membership, never from the request body.
- Uploads are limited to 10 MB and an allow-list of MIME types, extensions, and file signatures.
- Search, notifications, and file downloads use the same visibility rules as the pages.

## Known limitations

- No live email, no payment processor, and no e-signature.
- One membership per user per organization, and the session’s active organization is chosen at login.
- Task dependencies are a single prerequisite list with a direct-cycle check, not a full scheduler. There is no Gantt chart.
- Platform admin can list organizations only.
- File bytes are removed on delete; the database row is kept with `deletedAt` so the id cannot be downloaded.
