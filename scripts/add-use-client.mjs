import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "dist/react.js",
  "dist/react.cjs",
  "dist/devtools/react.js",
  "dist/devtools/react.cjs",
  "dist/auth/firebase/client.js",
  "dist/auth/firebase/client.cjs",
];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  if (!source.startsWith('"use client";')) {
    writeFileSync(file, `"use client";\n${source}`);
  }
}
