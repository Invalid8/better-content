import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export class CommandError extends Error {
  constructor(command, code) {
    super(`${command} exited with code ${code}`);
    this.name = "CommandError";
  }
}

// Their CLIs are interactive by nature. We always pass the flags that pin a
// known layout, and stdio: "inherit" so their own output and any prompt we
// failed to suppress is visible rather than a silent hang.
export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new CommandError([command, ...args].join(" "), code));
    });
  });
}

export const npx = (args, options) =>
  run("npx", ["--yes", ...args], options);

export async function readJson(dir, file) {
  return JSON.parse(await readFile(join(dir, file), "utf8"));
}

export async function writeJson(dir, file, value) {
  await writeFile(join(dir, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

// Their scaffolder owns package.json; we only add what better-content needs.
export async function mergeDependencies(dir, { deps = {}, devDeps = {} }) {
  const pkg = await readJson(dir, "package.json");

  const merge = (existing = {}, added) =>
    Object.fromEntries(
      Object.entries({ ...existing, ...added }).sort(([a], [b]) =>
        a < b ? -1 : 1,
      ),
    );

  pkg.dependencies = merge(pkg.dependencies, deps);
  if (Object.keys(devDeps).length) {
    pkg.devDependencies = merge(pkg.devDependencies, devDeps);
  }

  await writeJson(dir, "package.json", pkg);
}

// Their starter ships a demo page. We replace the app that rendered it, so the
// pieces only that page used are dead weight. Best effort: a starter that stops
// shipping one of these should not fail the scaffold.
export function removeFiles(dir, paths) {
  return Promise.all(
    paths.map((path) => rm(join(dir, path), { force: true, recursive: true })),
  );
}

// vite.config.ts is code rather than JSON, so we edit it as text. Every
// insertion point is asserted: failing loudly here beats handing back a project
// that silently missed the Tailwind plugin.
export async function editViteConfig(dir, { imports = [], plugins = [], options = "" }) {
  const file = "vite.config.ts";
  let source = await readFile(join(dir, file), "utf8");

  if (imports.length) {
    const last = [...source.matchAll(/^import .*$/gm)].at(-1);
    if (!last) throw new Error(`${file}: no import statement to anchor to`);
    const at = last.index + last[0].length;
    source = `${source.slice(0, at)}\n${imports.join("\n")}${source.slice(at)}`;
  }

  if (plugins.length) {
    const array = /plugins:\s*\[/;
    if (!array.test(source)) throw new Error(`${file}: no plugins array to extend`);
    source = source.replace(array, (match) => `${match}${plugins.join(", ")}, `);
  }

  if (options) {
    const call = /defineConfig\(\{/;
    if (!call.test(source)) throw new Error(`${file}: no defineConfig call to extend`);
    source = source.replace(call, (match) => `${match}\n${options}`);
  }

  await writeFile(join(dir, file), source, "utf8");
}

export async function appendFile(dir, file, contents) {
  const path = join(dir, file);
  let existing = "";
  try {
    existing = await readFile(path, "utf8");
  } catch {
    existing = "";
  }
  await writeFile(path, `${existing.trimEnd()}\n\n${contents}`, "utf8");
}
