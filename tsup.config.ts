import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    core: "src/core/index.ts",
    server: "src/server/index.ts",
    devtools: "src/devtools/index.ts",
    react: "src/react/index.ts",
    "adapters/postgres": "src/adapters/postgres/index.ts",
    "adapters/firestore": "src/adapters/firestore/index.ts",
    "storage/cloudinary": "src/storage/cloudinary/index.ts",
    "storage/cloudinary/server": "src/storage/cloudinary/server.ts",
    "auth/firebase": "src/auth/firebase/index.ts",
    "auth/firebase/client": "src/auth/firebase/client/index.tsx",
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
  onSuccess: "node scripts/add-use-client.mjs",
});
