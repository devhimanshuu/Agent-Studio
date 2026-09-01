import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: ["e2e/**", "node_modules/**", "dist/**", ".next/**", "coverage/**"],
    projects: [
      {
        test: {
          globals: true,
          environment: "jsdom",
          include: ["tests/components/**/*.test.?(c|m)[jt]s?(x)"],
          setupFiles: ["tests/components/setup.ts"],
          name: "components",
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "./src"),
          },
        },
        esbuild: {
          jsx: "automatic",
          jsxImportSource: "react",
        },
      },
      {
        test: {
          globals: true,
          environment: "node",
          include: ["tests/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
          exclude: ["tests/components/**", "e2e/**", "node_modules/**", "dist/**", ".next/**", "coverage/**"],
          name: "default",
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "./src"),
          },
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
