import { defineConfig } from "vitest/config";

/**
 * End-to-end route checks against a running server (`pnpm build && pnpm start`, or `pnpm dev`).
 * Set E2E_BASE_URL to test another deployment; defaults to http://localhost:3000.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["e2e/**/*.e2e.ts"],
    setupFiles: ["test/setup.ts"],
    globalSetup: ["e2e/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
