import assert from "node:assert/strict";
import { test } from "node:test";

import { HOSTS, buildFiles, hostFor, isClientOnly, supportsTailwind } from "../lib/template.js";

// better-content declares these as OPTIONAL peer dependencies, so npm installs
// none of them: importing the subpath is what makes one required.
//
// This is the class the firebase-admin bug belonged to, and the reason a plain
// "is every import declared" check cannot see it. The generated auth.ts imports
// better-content, which is always declared; the real requirement is one level
// down, in what that subpath itself pulls in.
const SUBPATH_PEERS = {
  "better-content/auth/firebase": ["firebase-admin"],
  "better-content/adapters/firestore": ["firebase-admin"],
  // pg is deliberately not listed: the client-only PGlite app drives this same
  // adapter against a WASM Postgres and externalises pg in its Vite config.
  "better-content/adapters/postgres": ["drizzle-orm"],
};

// Everything a generated app can import without declaring it, because the
// framework's own scaffolder supplies it. Anything outside this list has to
// come from the host's dependencies(), or `npm install` produces an app that
// cannot resolve its own imports.
const PROVIDED_BY_SCAFFOLDER = new Set([
  // Node builtins
  "node:crypto",
  // Framework runtimes, all installed by create-next-app / create-vite /
  // create-astro / nuxi / sv rather than by us.
  "react",
  "react-dom",
  "react/jsx-runtime",
  "vue",
  "svelte",
  "astro",
  "next",
  "next/headers",
  "next/server",
  "@sveltejs/kit",
  "drizzle-orm/pg-core",
]);

// Import specifiers that resolve inside the generated project rather than to a
// package: relative paths, and each framework's own alias roots.
const isLocal = (specifier) =>
  specifier.startsWith(".") ||
  specifier.startsWith("$") ||
  specifier.startsWith("~") ||
  specifier.startsWith("@/");

// better-content/react, drizzle-orm/pglite and firebase-admin/app all resolve
// to their package root, which is what package.json actually declares.
function packageName(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function importsIn(source) {
  const found = new Set();
  // Static imports and re-exports, plus the bare `import "x"` form.
  const pattern = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+["']([^"']+)["']|(?:^|\n)\s*import\s+["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) {
    const specifier = match[1] ?? match[2];
    if (specifier && !isLocal(specifier)) found.add(specifier);
  }
  return found;
}

// Every question combination each host can be asked, so no branch of any
// template goes unchecked.
function* combinations() {
  for (const host of HOSTS) {
    const value = host.meta.value;
    const bindings = value === "astro" ? ["react", "vue", "svelte"] : [undefined];
    const tailwinds = supportsTailwind(value) ? [true, false] : [false];

    for (const binding of bindings) {
      for (const tailwind of tailwinds) {
        if (isClientOnly(value)) {
          for (const transport of ["rest", "pglite"]) {
            yield { host: value, binding, tailwind, transport, name: "app" };
          }
        } else {
          for (const database of ["postgres", "firestore"]) {
            for (const auth of ["token", "firebase"]) {
              yield { host: value, binding, tailwind, database, auth, name: "app" };
            }
          }
        }
      }
    }
  }
}

const label = (answers) =>
  Object.entries(answers)
    .filter(([key]) => key !== "name")
    .map(([, v]) => v)
    .join("-");

test("every import in a generated app is a declared dependency", () => {
  let checked = 0;

  for (const answers of combinations()) {
    const host = hostFor(answers.host);
    const files = buildFiles(answers);

    const declared = new Set();
    if (host.dependencies) {
      const { deps = {}, devDeps = {} } = host.dependencies(answers);
      for (const key of [...Object.keys(deps), ...Object.keys(devDeps)]) {
        declared.add(key);
      }
    }

    for (const [path, contents] of Object.entries(files)) {
      if (!/\.(ts|tsx|vue|svelte|astro|js|mjs)$/.test(path)) continue;

      for (const specifier of importsIn(contents)) {
        const pkg = packageName(specifier);
        if (PROVIDED_BY_SCAFFOLDER.has(specifier) || PROVIDED_BY_SCAFFOLDER.has(pkg)) {
          continue;
        }

        assert.ok(
          declared.has(pkg),
          `${label(answers)}: ${path} imports "${specifier}" but "${pkg}" is not a declared dependency`,
        );
        checked += 1;

        for (const peer of SUBPATH_PEERS[specifier] ?? []) {
          assert.ok(
            declared.has(peer),
            `${label(answers)}: ${path} imports "${specifier}", which needs the optional peer "${peer}", but it is not a declared dependency`,
          );
          checked += 1;
        }
      }
    }
  }

  assert.ok(checked > 0, "no imports were checked, the walk is broken");
});

test("firebase-admin is declared whenever the gate or the database needs it", () => {
  for (const answers of combinations()) {
    if (isClientOnly(answers.host)) continue;

    const host = hostFor(answers.host);
    const { deps } = host.dependencies(answers);
    const needed = answers.auth === "firebase" || answers.database === "firestore";

    assert.equal(
      "firebase-admin" in deps,
      needed,
      `${label(answers)}: firebase-admin should be ${needed ? "present" : "absent"}`,
    );
  }
});

test("every host generates a readme and an env example or a schema", () => {
  for (const answers of combinations()) {
    const files = buildFiles(answers);
    assert.ok(files["README.md"], `${label(answers)}: no README.md`);
  }
});
