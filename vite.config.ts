import { defineConfig } from "vite";
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
});
