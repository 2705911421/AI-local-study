import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  root: projectRoot,
  test: {
    environment: "node",
    include: ["electron/**/*.test.ts"],
    exclude: ["node_modules/**"],
  },
});
