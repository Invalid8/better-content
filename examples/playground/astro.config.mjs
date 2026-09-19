import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import svelte from "@astrojs/svelte";
import vue from "@astrojs/vue";

export default defineConfig({
  site: "https://better-content-playground.vercel.app",
  integrations: [react(), svelte(), vue()],
  vite: {
    resolve: {
      // Two copies of a framework means refs made by one are invisible to the
      // other's render effect. The file:../.. link makes this reachable.
      dedupe: ["react", "react-dom", "vue"],
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
