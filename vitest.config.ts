import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Keep Vitest's smart defaults while ensuring Playwright's e2e/ specs
    // (which use .spec.ts) never run under the unit runner.
    include: ["tests/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: ["e2e/**", "node_modules/**", "dist/**", ".next/**", "coverage/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
