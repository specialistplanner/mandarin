import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

// This build is intentionally isolated from the v0.5.1 production Pages path.
// Firebase client settings are loaded from the ignored project-root .env.local.
export default defineConfig({
  root: resolve(projectRoot, "github-pages"),
  envDir: projectRoot,
  base: "/mandarin-v06-staging/",
  publicDir: resolve(projectRoot, "public"),
  plugins: [react()],
  resolve: { alias: { "@": projectRoot } },
  build: {
    outDir: resolve(projectRoot, "dist-pages-staging"),
    emptyOutDir: true,
  },
});
