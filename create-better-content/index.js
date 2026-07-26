#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process, { stdin, stdout } from "node:process";
import * as readline from "node:readline";

import { HOSTS, buildFiles, isClientOnly } from "./lib/template.js";

const useColor =
  stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== "dumb";
const paint = (code) => (text) =>
  useColor ? `\u001b[${code}m${text}\u001b[0m` : text;
const c = {
  bold: paint("1"),
  dim: paint("2"),
  accent: paint("36"),
  green: paint("32"),
  red: paint("31"),
};

const QUESTIONS = [
  {
    key: "host",
    flag: "--framework",
    short: "-f",
    message: "Which framework?",
    options: HOSTS.map(({ meta }) => ({
      value: meta.value,
      label: meta.label,
      hint: meta.hint,
    })),
  },
  {
    key: "binding",
    flag: "--binding",
    short: "-b",
    message: "Which framework for the island?",
    when: (answers) => answers.host === "astro",
    options: [
      { value: "react", label: "React", hint: "ContentEditSpan, EditableImage" },
      { value: "vue", label: "Vue", hint: "v-content-edit, useEditableImage" },
      { value: "svelte", label: "Svelte", hint: "use:contentEdit, imageEdit" },
    ],
  },
  {
    key: "transport",
    flag: "--transport",
    short: "-t",
    message: "Where do the writes go?",
    when: (answers) => isClientOnly(answers.host),
    options: [
      {
        value: "rest",
        label: "An API you already run",
        hint: "restTransport, you gate it server side",
      },
      {
        value: "pglite",
        label: "In-browser Postgres",
        hint: "PGlite in IndexedDB, no server at all",
      },
    ],
  },
  {
    key: "database",
    flag: "--database",
    short: "-d",
    message: "Where does your content live?",
    when: (answers) => !isClientOnly(answers.host),
    options: [
      {
        value: "postgres",
        label: "Postgres",
        hint: "Drizzle, you own the schema",
      },
      { value: "firestore", label: "Firestore", hint: "firebase-admin" },
    ],
  },
  {
    key: "auth",
    flag: "--auth",
    short: "-a",
    message: "How should writes be gated?",
    when: (answers) => !isClientOnly(answers.host),
    options: [
      {
        value: "token",
        label: "Admin token",
        hint: "no external service, works offline",
      },
      {
        value: "firebase",
        label: "Firebase",
        hint: "ID token + email allowlist",
      },
    ],
  },
];

function help() {
  const values = (key) =>
    QUESTIONS.find((q) => q.key === key)
      .options.map((o) => o.value)
      .join("|");
  const frameworks = values("host");
  const bindings = values("binding");
  const transports = values("transport");
  const databases = values("database");
  const auths = values("auth");
  stdout.write(`
${c.bold("create-better-content")}

  Scaffold an app with inline editing wired to your own database.

${c.bold("Usage")}
  npm create better-content@latest [directory]
  npm create better-content@latest [directory] -- [options]
  ${c.dim("npm needs the -- separator before flags, or it reads them itself.")}

${c.bold("Options")}
  -f, --framework <${frameworks}>
  -b, --binding   <${bindings}>   ${c.dim("astro only")}
  -t, --transport <${transports}>            ${c.dim("client-only frameworks only")}
  -d, --database  <${databases}>      ${c.dim("full-stack frameworks only")}
  -a, --auth      <${auths}>          ${c.dim("full-stack frameworks only")}
  -y, --yes             skip prompts, use defaults for anything not given
  -h, --help            show this message

${c.dim("The last three frameworks have no server, so they take a transport")}
${c.dim("instead of a database and a gate: writes go to an API you already run,")}
${c.dim("or to Postgres running in the browser.")}

${c.bold("Examples")}
  npm create better-content@latest my-site -- -f next -d postgres -a token
  npx create-better-content my-site -f react -t pglite
`);
}

function parseArgs(argv) {
  const answers = {};
  let directory;
  let yes = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") return { help: true };
    if (arg === "-y" || arg === "--yes") {
      yes = true;
      continue;
    }
    const question = QUESTIONS.find(
      (q) => q.flag === arg || q.short === arg || arg.startsWith(`${q.flag}=`),
    );
    if (question) {
      const value = arg.includes("=") ? arg.split("=")[1] : argv[++i];
      const valid = question.options.map((o) => o.value);
      if (!valid.includes(value)) {
        throw new Error(
          `${question.flag} must be one of: ${valid.join(", ")} (got ${value ?? "nothing"})`,
        );
      }
      answers[question.key] = value;
      continue;
    }
    if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    if (directory === undefined) directory = arg;
  }

  return { answers, directory, yes };
}

function select(message, options) {
  return new Promise((done) => {
    let index = 0;
    const height = options.length + 1;

    const render = (initial) => {
      if (!initial) stdout.write(`\u001b[${height}A`);
      stdout.write(`\u001b[2K${c.bold(message)}\n`);
      for (const [i, option] of options.entries()) {
        const active = i === index;
        const marker = active ? c.accent("❯ ") : "  ";
        const label = active ? c.accent(option.label) : option.label;
        const hint = option.hint ? c.dim(`  ${option.hint}`) : "";
        stdout.write(`\u001b[2K  ${marker}${label}${hint}\n`);
      }
    };

    const finish = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("keypress", onKey);
      stdout.write(`\u001b[${height}A`);
      for (let i = 0; i < height; i += 1) stdout.write("\u001b[2K\n");
      stdout.write(`\u001b[${height}A`);
      stdout.write(
        `${c.green("✔")} ${message} ${c.accent(options[index].label)}\n`,
      );
      done(options[index].value);
    };

    const onKey = (_str, key) => {
      if (key.ctrl && key.name === "c") {
        stdout.write("\n");
        process.exit(130);
      }
      if (key.name === "up" || key.name === "k") {
        index = (index - 1 + options.length) % options.length;
        render(false);
      } else if (key.name === "down" || key.name === "j") {
        index = (index + 1) % options.length;
        render(false);
      } else if (/^[1-9]$/.test(key.name ?? "")) {
        const n = Number(key.name) - 1;
        if (n < options.length) {
          index = n;
          render(false);
        }
      } else if (key.name === "return") {
        finish();
      }
    };

    readline.emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("keypress", onKey);
    render(true);
  });
}

function ask(message, fallback) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  return new Promise((done) => {
    rl.question(`${c.bold(message)} ${c.dim(`(${fallback})`)} `, (answer) => {
      rl.close();
      done(answer.trim() || fallback);
    });
  });
}

async function directoryIsUsable(target) {
  if (!existsSync(target)) return true;
  const entries = await readdir(target);
  return entries.filter((e) => e !== ".git").length === 0;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    help();
    return;
  }

  const { answers, yes } = parsed;
  const interactive = stdin.isTTY && !yes;

  stdout.write(`\n${c.bold("better-content")} ${c.dim("· new project")}\n\n`);

  let directory = parsed.directory;
  if (directory === undefined) {
    directory = interactive
      ? await ask("Project directory?", "my-content-site")
      : "my-content-site";
  }

  for (const question of QUESTIONS) {
    if (question.when && !question.when(answers)) {
      delete answers[question.key];
      continue;
    }
    if (answers[question.key]) continue;
    answers[question.key] = interactive
      ? await select(question.message, question.options)
      : question.options[0].value;
  }

  const target = resolve(process.cwd(), directory);
  if (!(await directoryIsUsable(target))) {
    throw new Error(
      `${directory} already exists and is not empty. Pick another directory.`,
    );
  }

  const name = directory.split("/").filter(Boolean).pop() ?? "my-content-site";
  const files = buildFiles({ ...answers, name });

  for (const [path, contents] of Object.entries(files)) {
    const full = join(target, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, contents, "utf8");
  }

  const count = Object.keys(files).length;
  stdout.write(
    `\n${c.green("Done.")} ${count} files in ${c.bold(directory)}\n\n`,
  );
  stdout.write(`${c.bold("Next")}\n`);
  stdout.write(`  cd ${directory}\n`);
  stdout.write(`  npm install\n`);
  stdout.write(`  cp .env.example .env    ${c.dim("# then fill it in")}\n`);
  stdout.write(`  npm run dev\n\n`);
  stdout.write(
    `${c.dim("The generated README covers the schema, the gate, and how to deploy.")}\n\n`,
  );
}

main().catch((error) => {
  stdout.write(`\n${c.red("Error:")} ${error.message}\n\n`);
  process.exit(1);
});
