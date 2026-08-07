import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Vitest's defaults exclude node_modules/dist/.git/etc. but not a nested
    // git worktree — without this, running the suite from the main checkout
    // also discovers and runs every test file under .worktrees/<name>/,
    // which resolves bare imports (react, etc.) against THAT worktree's own
    // node_modules instead of this one, loading two copies of React into
    // the same process and crashing hooks ("Cannot read properties of null
    // (reading 'useState')") in every component test.
    exclude: [...configDefaults.exclude, "**/.worktrees/**", "**/worktrees/**"],
  },
  resolve: {
    // Mirror the "@/*" -> project root alias from tsconfig.json.
    alias: { "@": resolve(__dirname, ".") },
  },
});
