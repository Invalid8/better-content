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
  },
});
