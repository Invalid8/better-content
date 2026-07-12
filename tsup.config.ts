import { defineConfig, type Options } from "tsup";

const shared: Options = {
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
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
};

export default defineConfig([
  {
    ...shared,
    entry: {
      index: "src/index.ts",
      core: "src/core/index.ts",
    },
    clean: true,
  },
  {
    ...shared,
    entry: {
      react: "src/react/index.ts",
    },
    banner: { js: '"use client";' },
    clean: false,
  },
]);
