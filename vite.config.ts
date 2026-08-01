import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const isWebBuild = process.env.ZHIYE_BUILD_TARGET === "web";

export default defineConfig({
  base: isWebBuild ? "/" : "./",
  plugins: [react()],
  build: {
    outDir: isWebBuild ? "dist/client" : "dist",
  },
  server: {
    port: 4173,
    strictPort: true,
  },
  test: {
    exclude: [
      "tests/e2e/**",
      "tests/desktop/**",
      "tests/site-worker.test.mjs",
      "node_modules/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/types.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
      thresholds: {
        statements: 45,
        branches: 55,
        functions: 40,
        lines: 45,
      },
    },
  },
});
