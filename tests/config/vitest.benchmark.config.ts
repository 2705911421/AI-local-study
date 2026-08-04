import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  root: projectRoot,
  plugins: [react()],
  test: {
    include: ["tests/benchmark/**/*.test.ts"],
    exclude: ["node_modules/**"],
    fileParallelism: false,
    setupFiles: ["tests/benchmark/setup.ts"],
  },
});
