import { defineConfig } from "prisma/config";

// Prisma stops auto-loading .env once a config file is present, so load it here
// (Node built-in — no new dependency). Uses .env, matching prior CLI behaviour.
process.loadEnvFile();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
});
