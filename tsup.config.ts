import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    core: "src/core/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    /^better-content(\/.+)?$/,
    /^drizzle-orm(\/.+)?$/,
    /^pg$/,
    /^firebase(\/.+)?$/,
    /^firebase-admin(\/.+)?$/,
    /^cloudinary$/,
    /^react(\/.+)?$/,
    /^react-dom(\/.+)?$/,
  ],
});
