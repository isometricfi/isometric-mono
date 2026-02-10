import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true, // Allow global `test`, `expect`, `describe`
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
