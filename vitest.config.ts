import { defineConfig } from "vitest/config"

/**
 * Root Vitest config.
 *
 * This replaces `vitest.workspace.ts`, which Vitest 4 no longer reads — the
 * workspace file was silently ignored, so bare `vitest` ran with no `@api`
 * alias and no include filter: most files failed to collect, and Playwright's
 * specs under `tests/e2e/` were dragged in. The project definitions below are a
 * direct translation of that file.
 *
 * `tests/e2e/` stays out on purpose: those are Playwright specs, run by
 * `yarn test:e2e` against a live server.
 */
export default defineConfig({
  test: {
    projects: [
      // Backend API tests
      {
        extends: "./vitest.config.api.ts",
        test: {
          name: "api",
          include: ["api/**/*.test.ts"],
          environment: "node",
        },
      },
      // Frontend tests
      {
        extends: "./vitest.config.frontend.ts",
        test: {
          name: "frontend",
          include: ["app/**/*.test.{ts,tsx}", "components/**/*.test.{ts,tsx}", "hooks/**/*.test.{ts,tsx}"],
          environment: "jsdom",
        },
      },
    ],
  },
})
