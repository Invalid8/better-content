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
      server: "src/server/index.ts",
      "adapters/postgres": "src/adapters/postgres/index.ts",
      "adapters/firestore": "src/adapters/firestore/index.ts",
      "storage/cloudinary": "src/storage/cloudinary/index.ts",
      "storage/cloudinary/server": "src/storage/cloudinary/server.ts",
      "auth/firebase": "src/auth/firebase/index.ts",
    },
    clean: true,
  },
  {
    ...shared,
    entry: {
      react: "src/react/index.ts",
      "auth/firebase/client": "src/auth/firebase/client/index.tsx",
    },
    banner: { js: '"use client";' },
    clean: false,
  },
]);
