// vitest.config.ts
import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./api/tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@api": path.resolve(__dirname, "api"),
    },
  },
})
