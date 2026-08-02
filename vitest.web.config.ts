import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**"],
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
        "src/lib/backupCrypto.ts": {
          statements: 90,
          branches: 75,
          functions: 90,
          lines: 90,
        },
        "src/lib/document.ts": {
          statements: 55,
          branches: 70,
          functions: 55,
          lines: 55,
        },
        "src/lib/learningEngine.ts": {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
        "src/lib/studyRepository.ts": {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
      },
    },
  },
});
