import { PrismaClient } from "@prisma/client";
import { hashPassword, hashToken } from "../src/lib/auth/password";
import { writeStoredFile } from "../src/lib/files";

const prisma = new PrismaClient();
const PASSWORD = "Password123!";
const INVITE_TOKEN = "northline-demo-invite-token";

function utcDay(offset: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

async function main() {
  if (process.env.DATABASE_URL?.includes("portal_test")) {
    throw new Error("Refusing to seed the test database.");
  }
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Organization" CASCADE`);
  const passwordHash = await hashPassword(PASSWORD, 10);

  const northline = await prisma.organization.create({
    data: { name: "Northline Studio", slug: "northline", deadlineReminderDays: 3, emailNotificationsEnabled: true },
  });
  const harbor = await prisma.organization.create({
    data: { name: "Harbor Collective", slug: "harbor", deadlineReminderDays: 3 },
  });

  const emails = {
    platform: "platform@northline.test",
    owner: "owner@northline.test",
    pm: "pm@northline.test",
    member: "member@northline.test",
    ada: "ada@acme.test",
    cole: "cole@acme.test",
    rory: "rory@acme.test",
    gina: "gina@globex.test",
    harbor: "owner@harbor.test",
  } as const;
  const names: Record<keyof typeof emails, string> = {
    platform: "Pat Platform",
    owner: "Olivia Owner",
    pm: "Priya Manager",
    member: "Miles Member",
    ada: "Ada Admin",
    cole: "Cole Collaborator",
    rory: "Rory Reader",
    gina: "Gina Globex",
    harbor: "Harper Harbor",
  };
  const users = {} as Record<keyof typeof emails, { id: string }>;
  for (const key of Object.keys(emails) as (keyof typeof emails)[]) {
    const user = await prisma.user.create({
      data: { email: emails[key], name: names[key], passwordHash },
    });
    users[key] = user;
  }

  await prisma.membership.createMany({
    data: [
      { userId: users.platform.id, organizationId: northline.id, role: "PLATFORM_ADMIN" },
      { userId: users.owner.id, organizationId: northline.id, role: "AGENCY_OWNER" },
      { userId: users.pm.id, organizationId: northline.id, role: "PROJECT_MANAGER" },
      { userId: users.member.id, organizationId: northline.id, role: "TEAM_MEMBER" },
      { userId: users.harbor.id, organizationId: harbor.id, role: "AGENCY_OWNER" },
    ],
  });

  const acme = await prisma.clientCompany.create({
    data: { organizationId: northline.id, name: "Acme Robotics", website: "https://acme.example", notes: "Internal: prefers Friday reviews." },
  });
  const globex = await prisma.clientCompany.create({
    data: { organizationId: northline.id, name: "Globex Media", website: "https://globex.example", notes: "Internal only." },
  });
  const pinetree = await prisma.clientCompany.create({
    data: { organizationId: harbor.id, name: "Pinetree Clinics" },
  });

  await prisma.membership.createMany({
    data: [
      { userId: users.ada.id, organizationId: northline.id, role: "CLIENT_ADMIN", clientCompanyId: acme.id },
      { userId: users.cole.id, organizationId: northline.id, role: "CLIENT_COLLABORATOR", clientCompanyId: acme.id },
      { userId: users.rory.id, organizationId: northline.id, role: "READ_ONLY", clientCompanyId: acme.id },
      { userId: users.gina.id, organizationId: northline.id, role: "CLIENT_ADMIN", clientCompanyId: globex.id },
    ],
  });

  const steps = [
    ["Confirm the main contact", "Name the person who can approve deliverables."],
    ["Share access and assets", "Send the files the team needs to start."],
    ["Confirm scope", "Review the written scope before work begins."],
    ["Confirm billing contact", "Tell the team who should receive invoices."],
  ];
  await prisma.clientOnboardingStep.createMany({
    data: steps.map(([title, description], index) => ({
      clientCompanyId: acme.id,
      title,
      description,
      sortOrder: index + 1,
      completedAt: index === 0 ? new Date() : null,
      completedById: index === 0 ? users.owner.id : null,
    })),
  });

  const website = await prisma.project.create({
    data: {
      organizationId: northline.id,
      clientCompanyId: acme.id,
      name: "Website Redesign",
      reference: "WEB-104",
      description: "A calmer marketing site for Acme Robotics.",
      scope: "Homepage, product page, and a shared component pass.",
      internalNotes: "Margin target stays internal.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      startDate: utcDay(-14),
      dueDate: utcDay(21),
      agreedFee: "18000.00",
      agreedFeeClientVisible: true,
      internalEstimate: "11000.00",
      createdById: users.owner.id,
    },
  });
  const globexProject = await prisma.project.create({
    data: {
      organizationId: northline.id,
      clientCompanyId: globex.id,
      name: "Brand Audit",
      reference: "GLO-220",
      description: "A short audit for Globex.",
      status: "PLANNING",
      priority: "MEDIUM",
      createdById: users.pm.id,
      agreedFee: "4000.00",
      internalEstimate: "2500.00",
    },
  });
  const harborProject = await prisma.project.create({
    data: {
      organizationId: harbor.id,
      clientCompanyId: pinetree.id,
      name: "Care site",
      reference: "PIN-014",
      status: "PLANNING",
      createdById: users.harbor.id,
    },
  });

  await prisma.projectMember.createMany({
    data: [
      { projectId: website.id, userId: users.owner.id, role: "PROJECT_MANAGER" },
      { projectId: website.id, userId: users.pm.id, role: "PROJECT_MANAGER" },
      { projectId: website.id, userId: users.member.id, role: "TEAM_MEMBER" },
      { projectId: website.id, userId: users.ada.id, role: "CLIENT_ADMIN" },
      { projectId: website.id, userId: users.cole.id, role: "CLIENT_COLLABORATOR" },
      { projectId: website.id, userId: users.rory.id, role: "READ_ONLY" },
      { projectId: globexProject.id, userId: users.pm.id, role: "PROJECT_MANAGER" },
      { projectId: globexProject.id, userId: users.gina.id, role: "CLIENT_ADMIN" },
      { projectId: harborProject.id, userId: users.harbor.id, role: "PROJECT_MANAGER" },
    ],
  });

  const discovery = await prisma.milestone.create({
    data: { projectId: website.id, title: "Discovery", description: "Interviews and goals.", dueDate: utcDay(-2), sortOrder: 1 },
  });
  const design = await prisma.milestone.create({
    data: { projectId: website.id, title: "Design", description: "Homepage concepts.", dueDate: utcDay(7), sortOrder: 2 },
  });
  await prisma.milestone.create({
    data: { projectId: website.id, title: "Build", description: "Implementation has not started.", dueDate: utcDay(20), sortOrder: 3 },
  });

  const interviews = await prisma.task.create({
    data: {
      projectId: website.id,
      milestoneId: discovery.id,
      title: "Stakeholder interviews",
      description: "Talk with Acme product and marketing.",
      assigneeId: users.member.id,
      creatorId: users.pm.id,
      status: "DONE",
      priority: "MEDIUM",
      dueDate: utcDay(-3),
      estimateHours: "6.00",
      clientVisible: true,
    },
  });
  const wireframes = await prisma.task.create({
    data: {
      projectId: website.id,
      milestoneId: design.id,
      title: "Homepage wireframes",
      description: "Desktop and the content outline.",
      assigneeId: users.member.id,
      creatorId: users.pm.id,
      status: "IN_REVIEW",
      priority: "HIGH",
      dueDate: utcDay(1),
      estimateHours: "12.00",
      clientVisible: true,
    },
  });
  await prisma.task.create({
    data: {
      projectId: website.id,
      milestoneId: design.id,
      title: "Internal moodboard",
      description: "Staff-only reference. Not for the client portal.",
      assigneeId: users.member.id,
      creatorId: users.pm.id,
      status: "TODO",
      priority: "LOW",
      clientVisible: false,
      estimateHours: "2.00",
    },
  });
  await prisma.task.create({
    data: {
      projectId: website.id,
      milestoneId: design.id,
      parentTaskId: wireframes.id,
      title: "Mobile breakpoint",
      assigneeId: users.member.id,
      creatorId: users.pm.id,
      status: "TODO",
      priority: "MEDIUM",
      dueDate: utcDay(3),
      clientVisible: true,
    },
  });
  const copyDeck = await prisma.task.create({
    data: {
      projectId: website.id,
      milestoneId: design.id,
      title: "Homepage copy deck",
      assigneeId: users.pm.id,
      creatorId: users.pm.id,
      status: "BLOCKED",
      priority: "MEDIUM",
      clientVisible: true,
    },
  });
  await prisma.taskDependency.create({ data: { taskId: copyDeck.id, blockedByTaskId: wireframes.id } });
  await prisma.taskStatusChange.createMany({
    data: [
      { taskId: interviews.id, fromStatus: "TODO", toStatus: "DONE", changedById: users.member.id },
      { taskId: wireframes.id, fromStatus: "TODO", toStatus: "IN_REVIEW", changedById: users.member.id },
    ],
  });

  const deliverable = await prisma.deliverable.create({
    data: {
      projectId: website.id,
      title: "Homepage concepts",
      description: "Two directions for the homepage.",
      createdById: users.pm.id,
    },
  });
  const version = await prisma.deliverableVersion.create({
    data: {
      deliverableId: deliverable.id,
      versionNumber: 1,
      notes: "Direction A is the recommended path.",
      status: "SUBMITTED",
      submittedAt: new Date(),
      submittedById: users.pm.id,
    },
  });

  async function storeFile(input: {
    name: string;
    body: string;
    clientVisible: boolean;
    category: "BRIEF" | "DELIVERABLE" | "OTHER";
    deliverableVersionId?: string;
  }) {
    const created = await prisma.fileAsset.create({
      data: {
        organizationId: northline.id,
        projectId: website.id,
        uploadedById: users.pm.id,
        category: input.category,
        originalName: input.name,
        mimeType: "text/plain",
        sizeBytes: Buffer.byteLength(input.body),
        storageKey: `pending/${input.name}`,
        clientVisible: input.clientVisible,
        deliverableVersionId: input.deliverableVersionId,
      },
    });
    const storageKey = `${northline.id}/${created.id}`;
    await writeStoredFile(storageKey, Buffer.from(input.body, "utf8"));
    await prisma.fileAsset.update({ where: { id: created.id }, data: { storageKey } });
  }
  await storeFile({ name: "brief.txt", body: "Shared project brief for Acme Robotics.\n", clientVisible: true, category: "BRIEF" });
  await storeFile({ name: "staff-note.txt", body: "Internal staffing note. Do not share.\n", clientVisible: false, category: "OTHER" });
  await storeFile({
    name: "concepts.txt",
    body: "Homepage concept notes for review.\n",
    clientVisible: true,
    category: "DELIVERABLE",
    deliverableVersionId: version.id,
  });

  await prisma.comment.createMany({
    data: [
      {
        projectId: website.id,
        authorId: users.pm.id,
        body: "The homepage concepts are ready when you are.",
        clientVisible: true,
      },
      {
        projectId: website.id,
        authorId: users.owner.id,
        body: "Internal: keep the second designer off this phase.",
        clientVisible: false,
      },
    ],
  });

  await prisma.invoice.create({
    data: {
      organizationId: northline.id,
      projectId: website.id,
      clientCompanyId: acme.id,
      number: "INV-1041",
      amount: "9000.00",
      status: "UNPAID",
      issuedDate: utcDay(-1),
      clientVisible: true,
      notes: "Deposit for discovery and design.",
    },
  });
  await prisma.changeRequest.create({
    data: {
      projectId: website.id,
      title: "Extra product page",
      description: "Add one more template.",
      amount: "2500.00",
      status: "REQUESTED",
      clientVisible: true,
      requestedById: users.pm.id,
    },
  });
  await prisma.timeEntry.create({
    data: {
      organizationId: northline.id,
      projectId: website.id,
      taskId: wireframes.id,
      userId: users.member.id,
      minutes: 90,
      billable: true,
      workDate: utcDay(-1),
      note: "Wireframe pass",
    },
  });

  await prisma.activityEvent.createMany({
    data: [
      {
        organizationId: northline.id,
        projectId: website.id,
        actorId: users.owner.id,
        type: "PROJECT_CREATED",
        clientVisible: true,
        summary: "Project Website Redesign (WEB-104) was created.",
        entityType: "project",
        entityId: website.id,
      },
      {
        organizationId: northline.id,
        projectId: website.id,
        actorId: users.pm.id,
        type: "DELIVERABLE_SUBMITTED",
        clientVisible: true,
        summary: "“Homepage concepts” version 1 was submitted for review.",
        entityType: "deliverable_version",
        entityId: version.id,
      },
      {
        organizationId: northline.id,
        projectId: website.id,
        actorId: users.owner.id,
        type: "COMMENT_ADDED",
        clientVisible: false,
        summary: "An internal note was added.",
        entityType: "comment",
        entityId: website.id,
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        organizationId: northline.id,
        userId: users.ada.id,
        channel: "IN_APP",
        status: "SENT",
        type: "deliverable.submitted",
        title: "Review needed: Homepage concepts",
        body: "Version 1 was submitted for review.",
        linkPath: `/portal/projects/${website.id}/deliverables`,
        dedupeKey: `inapp:seed:review:${users.ada.id}`,
      },
      {
        organizationId: northline.id,
        userId: users.member.id,
        channel: "IN_APP",
        status: "SENT",
        type: "task.assigned",
        title: "Assigned: Homepage wireframes",
        body: "You were assigned “Homepage wireframes”.",
        linkPath: `/projects/${website.id}/tasks`,
        dedupeKey: `inapp:seed:assign:${users.member.id}`,
      },
      {
        organizationId: northline.id,
        userId: users.ada.id,
        channel: "EMAIL",
        status: "SENT",
        type: "deliverable.submitted",
        title: "Review needed: Homepage concepts",
        body: "Version 1 was submitted for review.",
        linkPath: `/portal/projects/${website.id}/deliverables`,
        dedupeKey: `email:seed:review:${users.ada.id}`,
        sentAt: new Date(),
      },
    ],
  });

  const invitation = await prisma.invitation.create({
    data: {
      organizationId: northline.id,
      email: "new.person@acme.test",
      role: "CLIENT_COLLABORATOR",
      clientCompanyId: acme.id,
      tokenHash: hashToken(INVITE_TOKEN),
      expiresAt: utcDay(7),
      createdById: users.owner.id,
    },
  });
  await prisma.invitationProject.create({ data: { invitationId: invitation.id, projectId: website.id } });

  console.info("Seeded Northline Studio and Harbor Collective.");
  console.info(`Demo password for every seeded user: ${PASSWORD}`);
  console.info(`Open invitation: /invite/${INVITE_TOKEN}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
