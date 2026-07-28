import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 4173,
    strictPort: true,
  },
  test: {
    exclude: ["tests/e2e/**", "tests/desktop/**", "node_modules/**"],
  },
});
