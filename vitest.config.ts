import path from "node:path";
import { defineConfig } from "vitest/config";

const testDatabaseUrl =
  "postgresql://portal:portal@127.0.0.1:5432/portal_test?schema=public";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    sequence: { concurrent: false },
    hookTimeout: 60000,
    testTimeout: 30000,
    env: {
      DATABASE_URL: testDatabaseUrl,
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
