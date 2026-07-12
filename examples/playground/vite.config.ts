import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "better-content/core": fileURLToPath(
        new URL("../../src/core/index.ts", import.meta.url),
      ),
      "better-content/react": fileURLToPath(
        new URL("../../src/react/index.ts", import.meta.url),
      ),
    },
  },
});
