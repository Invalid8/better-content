import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const src = (path: string) =>
  fileURLToPath(new URL(`../../src/${path}`, import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "better-content/core": src("core/index.ts"),
      "better-content/react": src("react/index.ts"),
      "better-content/server": src("server/index.ts"),
      "better-content/adapters/postgres": src("adapters/postgres/index.ts"),
    },
  },
  optimizeDeps: {
    exclude: ["@electric-sql/pglite"],
  },
});
