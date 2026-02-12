import { defineWorkspace } from "vitest/config"

export default defineWorkspace([
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
      include: [
        "app/**/*.test.{ts,tsx}",
        "components/**/*.test.{ts,tsx}",
        "hooks/**/*.test.{ts,tsx}",
      ],
      environment: "jsdom",
    },
  },
])
