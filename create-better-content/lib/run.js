import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
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
