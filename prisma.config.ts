import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma stops auto-loading .env once a config file is present, so load it here
// (Node built-in — no new dependency). Uses .env, matching prior CLI behaviour.
// CI has no .env — env comes from GitHub Actions secrets — and loadEnvFile
// throws ENOENT on a missing file, so only load it when it exists.
if (existsSync(".env")) process.loadEnvFile();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
});
