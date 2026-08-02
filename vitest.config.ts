import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // create-better-content is a separate package with its own runner. Vitest
    // collects nothing from a node:test file and reports the empty result as a
    // pass, which reads as coverage that is not there. It runs in CI on its own.
    exclude: [...configDefaults.exclude, "create-better-content/**"],
  },
  resolve: {
    alias: {
      "better-content/core": fileURLToPath(
        new URL("./src/core/index.ts", import.meta.url),
      ),
      "better-content/react": fileURLToPath(
        new URL("./src/react/index.ts", import.meta.url),
      ),
      "better-content/server": fileURLToPath(
        new URL("./src/server/index.ts", import.meta.url),
      ),
      "better-content/devtools": fileURLToPath(
        new URL("./src/devtools/index.ts", import.meta.url),
      ),
    },
  },
});
