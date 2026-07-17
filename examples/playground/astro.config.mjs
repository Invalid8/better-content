import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import svelte from "@astrojs/svelte";
import vue from "@astrojs/vue";

export default defineConfig({
  integrations: [react(), svelte(), vue()],
  vite: {
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      exclude: ["@electric-sql/pglite"],
    },
    build: {
      rollupOptions: {
        // The postgres adapter lazy-imports "pg" for the node-postgres
        // path; this demo drives it with PGlite, so the import never
        // runs in the browser and must not be resolved at bundle time.
        external: ["pg"],
      },
    },
  },
});
