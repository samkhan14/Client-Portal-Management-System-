import { afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db";

const url = process.env.DATABASE_URL ?? "";
if (!url.includes("portal_test")) {
  throw new Error(`Refusing to run tests against ${url || "an empty DATABASE_URL"}`);
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Organization" CASCADE`);
});

afterAll(async () => {
  await prisma.$disconnect();
});
