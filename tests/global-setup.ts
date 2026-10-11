import { execSync } from "node:child_process";

const url = "postgresql://portal:portal@127.0.0.1:5432/portal_test?schema=public";

export default function setup() {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
