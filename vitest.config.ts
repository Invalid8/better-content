import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "better-content/core": fileURLToPath(
        new URL("./src/core/index.ts", import.meta.url),
      ),
      "better-content/react": fileURLToPath(
        new URL("./src/react/index.ts", import.meta.url),
      ),
    },
  },
});
