// Pieces that are identical whatever host framework you picked. Everything
// here reads config from process.env, which every one of the four hosts
// supports, so these files never need a host-specific variant.

export const BETTER_CONTENT = "^0.3.1";

export const sorted = (object) =>
  Object.fromEntries(Object.entries(object).sort(([a], [b]) => (a < b ? -1 : 1)));

const FIREBASE_ADMIN = "^14.1.0";

// The database and the gate are chosen independently, and firebase-admin backs
// both the Firestore adapter and the Firebase gate. Postgres + Firebase is a
// real combination, so this has to key off both answers, not just the database.
export function serverDeps({ database, auth }) {
  const { deps, devDeps } =
    database === "postgres"
      ? {
          deps: { "drizzle-orm": "^0.45.0", pg: "^8.22.0" },
          devDeps: { "@types/pg": "^8.11.10" },
        }
      : { deps: { "firebase-admin": FIREBASE_ADMIN }, devDeps: {} };

  if (auth === "firebase") deps["firebase-admin"] = FIREBASE_ADMIN;

  return { deps, devDeps };
}

// Hosts differ in where server env vars come from: Next and Nuxt populate
// process.env from .env themselves, Vite (so SvelteKit) does not.
export const PROCESS_ENV = {
  importLine: "",
  read: (name) => `process.env.${name}`,
};

// Everything below is built on first use rather than at import time. Build
// tools import these modules just to analyse routes, and that must not require
// a live database or a service account to be configured yet.
const LAZY_NOTE = `// Built on first use, not at import: build tools import this module to analyse
// routes, and that must not require a configured database.`;

export function dataModule({ database }, env = PROCESS_ENV) {
  const imports = env.importLine ? `${env.importLine}\n` : "";

  if (database === "postgres") {
    return `import { PostgresDataAdapter } from "better-content/adapters/postgres";
import type { DataAdapter } from "better-content/core";
${imports}import { schema } from "./schema";

function connect(): DataAdapter {
  const connectionString = ${env.read("DATABASE_URL")};

  if (!connectionString) {
    throw new Error("DATABASE_URL is missing. Copy .env.example to .env first.");
  }

  return new PostgresDataAdapter({ connectionString, schema });
}

let instance: DataAdapter | undefined;

${LAZY_NOTE}
// This is also the only file that knows what your database is: swap it for
// Firestore, or your own DataAdapter, and nothing else in the app changes.
export const data = new Proxy({} as DataAdapter, {
  get(_target, key: string) {
    instance ??= connect();
    const value = Reflect.get(instance, key);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
`;
  }

  return `import { FirestoreDataAdapter } from "better-content/adapters/firestore";
import type { DataAdapter } from "better-content/core";
${imports}
function connect(): DataAdapter {
  return new FirestoreDataAdapter({
    credentials: {
      projectId: ${env.read("FIREBASE_PROJECT_ID")},
      clientEmail: ${env.read("FIREBASE_CLIENT_EMAIL")},
      privateKey: ${env.read("FIREBASE_PRIVATE_KEY")}?.replace(/\\\\n/g, "\\n"),
    },
  });
}

let instance: DataAdapter | undefined;

${LAZY_NOTE}
// This is also the only file that knows what your database is: swap it for
// Postgres, or your own DataAdapter, and nothing else in the app changes.
export const data = new Proxy({} as DataAdapter, {
  get(_target, key: string) {
    instance ??= connect();
    const value = Reflect.get(instance, key);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
`;
}

export function authModule({ auth }, env = PROCESS_ENV) {
  const imports = env.importLine ? `${env.importLine}\n` : "";

  if (auth === "token") {
    return `import { timingSafeEqual } from "node:crypto";
import type { AuthAdapter } from "better-content/core";
${imports}
export const ADMIN_COOKIE = "adminToken";

export function verifyToken(candidate: string): boolean {
  const expected = ${env.read("ADMIN_TOKEN")};
  if (!expected || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

// Every write passes through here. Visitors can toggle edit mode and type,
// but nothing persists without the admin cookie, and the check runs on the
// server where it cannot be bypassed from the console.
export const auth: AuthAdapter = {
  async verifyRequest(req) {
    const token = readCookie(req, ADMIN_COOKIE);
    if (!token || !verifyToken(token)) return null;
    return { isAdmin: true };
  },
};
`;
  }

  return `import { firebaseAuth } from "better-content/auth/firebase";
import type { AuthAdapter } from "better-content/core";
${imports}
// A request counts as admin only when the Firebase ID token is valid, carries
// the admin custom claim, AND the email is on this list. Both must agree.
function gate(): AuthAdapter {
  return firebaseAuth({
    adminEmails: (${env.read("ADMIN_EMAILS")} ?? "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean),
    credentials: {
      projectId: ${env.read("FIREBASE_PROJECT_ID")},
      clientEmail: ${env.read("FIREBASE_CLIENT_EMAIL")},
      privateKey: ${env.read("FIREBASE_PRIVATE_KEY")}?.replace(/\\\\n/g, "\\n"),
    },
  });
}

let instance: AuthAdapter | undefined;

${LAZY_NOTE}
export const auth: AuthAdapter = {
  verifyRequest: (req) => (instance ??= gate()).verifyRequest(req),
};
`;
}

export const schemaModule = () => `import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// You own this schema. The adapter is typed-only: it reads and writes exactly
// the columns declared here and throws on anything else, so there is no hidden
// DDL and no JSONB catch-all.
export const sections = pgTable("sections", {
  id: text("id").primaryKey(),
  heading: text("heading"),
  tagline: text("tagline"),
  order: integer("order"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Keys are collection names: fetchCollection("sections") reads this table.
export const schema = { sections };
`;

export const schemaSql = () => `-- Run this once against your database, or replace it with Drizzle Kit
-- migrations. better-content never creates or alters tables for you.

create table if not exists sections (
  id         text primary key,
  heading    text,
  tagline    text,
  "order"    integer,
  updated_at timestamptz default now()
);

insert into sections (id, heading, tagline, "order") values
  ('hero',
   'Edit this heading',
   'And this tagline. Both are columns on a row in your own database.',
   0)
on conflict (id) do nothing;
`;

export function envExample({ database, auth }) {
  const lines = [];

  if (database === "postgres") {
    lines.push(
      "# Any Postgres connection string (local, Neon, Supabase, RDS).",
      "DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres",
      "",
    );
  } else {
    lines.push(
      "# Firebase service account, from the console under Project settings.",
      "FIREBASE_PROJECT_ID=your-project",
      "FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com",
      'FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"',
      "",
    );
  }

  if (auth === "token") {
    lines.push(
      "# Anything unguessable. Sign in at /admin with this value to enable saving.",
      "ADMIN_TOKEN=change-me-before-you-deploy",
    );
  } else {
    lines.push(
      "# Comma separated. A signed-in Firebase user must match one of these",
      "# AND carry the admin custom claim before any write is accepted.",
      "ADMIN_EMAILS=you@example.com",
    );
    if (database === "postgres") {
      lines.push(
        "",
        "# Firebase service account for verifying ID tokens.",
        "FIREBASE_PROJECT_ID=your-project",
        "FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com",
        'FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"',
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

export const gitignore = (extra = []) =>
  `${["node_modules/", "dist/", ".env", ".env.*", "!.env.example", ".DS_Store", ...extra].join("\n")}\n`;

export const styles = () => `:root {
  color-scheme: light dark;
  --ink: #1b1a18;
  --muted: #5c5751;
  --line: #e2ddd2;
  --paper: #faf8f3;
  --accent: #c8622f;
}

@media (prefers-color-scheme: dark) {
  :root {
    --ink: #ece8e0;
    --muted: #a29c93;
    --line: #2f2c28;
    --paper: #14130f;
  }
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font: 16px/1.6 ui-sans-serif, system-ui, sans-serif;
}

main {
  max-width: 42rem;
  margin: 0 auto;
  padding: 4rem 1.5rem;
}

.page h1 {
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 1.1;
  margin: 0 0 1rem;
}

.page p {
  color: var(--muted);
  margin: 0 0 2rem;
}

.bar {
  display: flex;
  gap: 0.6rem;
  border-top: 1px solid var(--line);
  padding-top: 1.25rem;
}

button {
  font: inherit;
  padding: 0.45rem 1rem;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

button[aria-pressed="true"] {
  border-color: var(--accent);
  color: var(--accent);
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

input {
  font: inherit;
  width: 100%;
  padding: 0.5rem 0.7rem;
  margin-bottom: 1.25rem;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: transparent;
  color: inherit;
}

.error {
  color: var(--accent);
  margin-bottom: 1rem;
}

.admin-link {
  display: inline-block;
  margin-top: 2rem;
  color: var(--muted);
  font-size: 0.85rem;
}

/* Styling hooks the editing primitives set on whatever element you bind. */
[data-cms-editing] {
  border-radius: 3px;
  outline: 1px dashed var(--line);
  outline-offset: 3px;
  cursor: text;
}

[data-cms-focused] {
  outline: 2px solid var(--accent);
}
`;

export function readme({ host, database, auth, name, layout, deploy }) {
  const dbSetup =
    database === "postgres"
      ? `## 1. Point it at a database

Set \`DATABASE_URL\` in \`.env\`, then create the table:

\`\`\`sh
psql "$DATABASE_URL" -f schema.sql
\`\`\`

${layout.schemaPath} is the Drizzle definition of that same table, and it is
yours to change. The adapter is typed-only: it reads and writes exactly the
columns you declare and throws on anything else, so there is no hidden DDL
and no JSONB catch-all. Add a column in both places and it becomes editable.`
      : `## 1. Point it at a database

Put your Firebase service account values in \`.env\`. Collections are created
on first write, so there is nothing to migrate. The starter uses a
\`sections\` collection with a \`hero\` document.

Firestore honors the query operations it can run natively and throws on the
rest (\`contains\`, OR groups) rather than silently returning wrong results.`;

  const authSetup =
    auth === "token"
      ? `## 2. Unlock saving

Set \`ADMIN_TOKEN\` in \`.env\` to anything unguessable, then visit \`/admin\`
and enter it. That sets an httpOnly cookie which ${layout.authPath} checks on
every write, with a timing-safe comparison.

Anyone can toggle edit mode and type. Only requests carrying the cookie are
allowed to persist, and the check runs on the server where it cannot be
bypassed from the console.

This is deliberately the simplest gate that is still real. When you add
accounts, replace \`auth\` with any \`AuthAdapter\`; nothing else changes.`
      : `## 2. Unlock saving

Set \`ADMIN_EMAILS\` and your Firebase service account values in \`.env\`.

A write is accepted only when the request carries a valid Firebase ID token
in the \`adminToken\` cookie, the token has the \`admin\` custom claim, AND
the email is on your list. Both must agree.

Sign a user in with the Firebase client SDK and store their ID token in that
cookie. React apps can use the provider that ships with the package:

\`\`\`ts
import { FirebaseAuthProvider } from "better-content/auth/firebase/client";
\`\`\`

Grant the claim once from a trusted script:

\`\`\`ts
await getAuth().setCustomUserClaims(uid, { admin: true });
\`\`\``;

  return `# ${name}

Inline editing wired to your own database, built with
[better-content](https://better-content-docs.vercel.app) on ${host.label}.

\`\`\`sh
npm install
cp .env.example .env
npm run dev
\`\`\`

${dbSetup}

${authSetup}

## 3. How the pieces fit

| File | Job |
|---|---|
| \`${layout.dataPath}\` | the only file that knows what your database is |
| \`${layout.authPath}\` | decides whether a request may write |
| \`${layout.routePath}\` | the CRUD surface, from one factory call |
| \`${layout.pagePath}\` | loads content on the server, hands it to the UI |
| \`${layout.componentPath}\` | the editable UI |

${host.bindingNote}

Field edits buffer locally and flush when you press Save. Item operations
(create, update, delete, reorder) apply immediately and roll back if the
server rejects them.

## 4. Deploy

${deploy}

The handlers speak web-standard Request/Response, so moving this to another
runtime is a matter of forwarding the request; the CMS layer does not change.
`;
}

// SvelteKit reads .env through its own $env modules; Vite does not populate
// process.env the way Next and Nuxt do.
export const SVELTEKIT_ENV = {
  importLine: 'import { env } from "$env/dynamic/private";',
  read: (name) => `env.${name}`,
};

// Our injected UI has to look at home in whichever project their scaffolder
// produced, so it either uses Tailwind utilities or a small stylesheet we
// append. One class map covers every framework.
export function styleKit(tailwind) {
  if (tailwind) {
    return {
      classes: {
        main: "mx-auto max-w-2xl px-6 py-16",
        page: "",
        h1: "text-4xl font-semibold tracking-tight",
        p: "mt-4 text-neutral-600 dark:text-neutral-400",
        bar: "mt-10 flex gap-2 border-t border-neutral-200 pt-5 dark:border-neutral-800",
        button:
          "rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:border-neutral-500 disabled:opacity-45 dark:border-neutral-700",
        note: "mt-6 text-sm text-neutral-500",
        input:
          "w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700",
        error: "mt-2 text-sm text-red-600",
        link: "mt-8 inline-block text-sm text-neutral-500 hover:underline",
      },
      css: CMS_HOOKS_CSS,
    };
  }

  return {
    classes: {
      main: "",
      page: "page",
      h1: "",
      p: "",
      bar: "bar",
      button: "",
      note: "note",
      input: "",
      error: "error",
      link: "admin-link",
    },
    css: `${PLAIN_CSS}\n${CMS_HOOKS_CSS}`,
  };
}

const CMS_HOOKS_CSS = `/* Styling hooks the editing primitives set on whatever element you bind. */
[data-cms-editing] {
  border-radius: 3px;
  outline: 1px dashed currentColor;
  outline-offset: 3px;
  opacity: 0.95;
  cursor: text;
}

[data-cms-focused] {
  outline-style: solid;
  outline-width: 2px;
  opacity: 1;
}`;

const PLAIN_CSS = `main {
  max-width: 42rem;
  margin: 0 auto;
  padding: 4rem 1.5rem;
  font: 16px/1.6 ui-sans-serif, system-ui, sans-serif;
}

.page h1 {
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 1.1;
  margin: 0 0 1rem;
}

.page p {
  opacity: 0.75;
  margin: 0 0 2rem;
}

.bar {
  display: flex;
  gap: 0.6rem;
  border-top: 1px solid currentColor;
  padding-top: 1.25rem;
}

.bar button {
  font: inherit;
  padding: 0.45rem 1rem;
  border: 1px solid currentColor;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.bar button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.note {
  font-size: 0.85rem;
  opacity: 0.7;
  margin-top: 1.5rem;
}

.admin-link {
  display: inline-block;
  margin-top: 2rem;
  font-size: 0.85rem;
  opacity: 0.7;
}`;
