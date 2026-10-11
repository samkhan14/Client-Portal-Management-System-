import { prisma } from "../src/lib/db";
import { scanApproachingDeadlines } from "../src/server/notifications";

const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
for (const org of orgs) {
  const result = await scanApproachingDeadlines(org.id);
  console.info(`${org.name}: scanned ${result.scanned}, new reminders ${result.created}`);
}
await prisma.$disconnect();
