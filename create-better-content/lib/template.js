// Every generated file lives here as a plain string builder. No template
// directory to keep in sync, no copy step: the CLI writes what these return.

const ASTRO = "^7.0.9";
const BETTER_CONTENT = "^0.3.0";

const FRAMEWORK = {
  react: {
    integration: "@astrojs/react",
    integrationVersion: "^6.0.1",
    component: "Editable.tsx",
    importPath: "../components/Editable",
    deps: { react: "^19.2.7", "react-dom": "^19.2.7" },
    devDeps: { "@types/react": "^19.2.17", "@types/react-dom": "^19.2.3" },
  },
  vue: {
    integration: "@astrojs/vue",
    integrationVersion: "^7.0.1",
    component: "Editable.vue",
    importPath: "../components/Editable.vue",
    deps: { vue: "^3.5.39" },
    devDeps: {},
  },
  svelte: {
    integration: "@astrojs/svelte",
    integrationVersion: "^9.0.1",
    component: "Editable.svelte",
    importPath: "../components/Editable.svelte",
    deps: { svelte: "^5.56.5" },
    devDeps: {},
  },
};

const sorted = (object) =>
  Object.fromEntries(Object.entries(object).sort(([a], [b]) => (a < b ? -1 : 1)));

function packageJson({ framework, database, name }) {
  const fw = FRAMEWORK[framework];
  const deps = {
    "@astrojs/node": "^11.0.2",
    [fw.integration]: fw.integrationVersion,
    astro: ASTRO,
    "better-content": BETTER_CONTENT,
    ...fw.deps,
  };
  const devDeps = { typescript: "^5.9.3", ...fw.devDeps };

  if (database === "postgres") {
    deps["drizzle-orm"] = "^0.45.0";
    deps.pg = "^8.22.0";
    devDeps["@types/pg"] = "^8.11.10";
  } else {
    deps["firebase-admin"] = "^14.1.0";
  }

  return `${JSON.stringify(
    {
      name,
      private: true,
      type: "module",
      scripts: {
        dev: "astro dev",
        build: "astro build",
        preview: "astro preview",
        start: "node ./dist/server/entry.mjs",
      },
      dependencies: sorted(deps),
      devDependencies: sorted(devDeps),
    },
    null,
    2,
  )}\n`;
}

function astroConfig({ framework }) {
  const fw = FRAMEWORK[framework];
  return `import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import ${framework} from "${fw.integration}";

export default defineConfig({
  // The CMS routes and the initial content load both run on the server,
  // so this app is server-rendered rather than a static build.
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [${framework}()],
});
`;
}

function tsconfig({ framework }) {
  const compilerOptions =
    framework === "react"
      ? { jsx: "react-jsx", jsxImportSource: "react" }
      : undefined;
  return `${JSON.stringify(
    {
      extends: "astro/tsconfigs/strict",
      include: [".astro/types.d.ts", "**/*"],
      exclude: ["dist"],
      ...(compilerOptions ? { compilerOptions } : {}),
    },
    null,
    2,
  )}\n`;
}

function envTypes({ database, auth }) {
  const vars = [];
  if (database === "postgres") {
    vars.push("  readonly DATABASE_URL: string;");
  } else {
    vars.push(
      "  readonly FIREBASE_PROJECT_ID: string;",
      "  readonly FIREBASE_CLIENT_EMAIL: string;",
      "  readonly FIREBASE_PRIVATE_KEY: string;",
    );
  }
  if (auth === "token") {
    vars.push("  readonly ADMIN_TOKEN: string;");
  } else {
    vars.push("  readonly ADMIN_EMAILS: string;");
    if (database === "postgres") {
      vars.push(
        "  readonly FIREBASE_PROJECT_ID: string;",
        "  readonly FIREBASE_CLIENT_EMAIL: string;",
        "  readonly FIREBASE_PRIVATE_KEY: string;",
      );
    }
  }
  return `/// <reference types="astro/client" />

interface ImportMetaEnv {
${[...new Set(vars)].join("\n")}
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
`;
}

function envExample({ database, auth }) {
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

const gitignore = () => `node_modules/
dist/
.astro/
.env
.env.production
.DS_Store
`;

function schemaTs() {
  return `import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
}

const schemaSql = () => `-- Run this once against your database, or replace it with Drizzle Kit
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

function dataTs({ database }) {
  if (database === "postgres") {
    return `import { PostgresDataAdapter } from "better-content/adapters/postgres";
import { schema } from "./schema";

const connectionString = import.meta.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing. Copy .env.example to .env first.");
}

// The one place that knows what your database is. Swap this for Firestore,
// or your own DataAdapter, and nothing else in the app changes.
export const data = new PostgresDataAdapter({ connectionString, schema });
`;
  }

  return `import { FirestoreDataAdapter } from "better-content/adapters/firestore";

// The one place that knows what your database is. Swap this for Postgres,
// or your own DataAdapter, and nothing else in the app changes.
export const data = new FirestoreDataAdapter({
  credentials: {
    projectId: import.meta.env.FIREBASE_PROJECT_ID,
    clientEmail: import.meta.env.FIREBASE_CLIENT_EMAIL,
    privateKey: import.meta.env.FIREBASE_PRIVATE_KEY?.replace(/\\\\n/g, "\\n"),
  },
});
`;
}

function authTs({ auth }) {
  if (auth === "token") {
    return `import { timingSafeEqual } from "node:crypto";
import type { AuthAdapter } from "better-content/core";

export const ADMIN_COOKIE = "adminToken";

export function verifyToken(candidate: string): boolean {
  const expected = import.meta.env.ADMIN_TOKEN;
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

// Every write passes through here. Visitors can toggle edit mode in the UI
// and type freely, but nothing persists without the admin cookie.
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

const adminEmails = (import.meta.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim())
  .filter(Boolean);

// A request is admin only when the Firebase ID token is valid, carries the
// admin custom claim, AND the email is on this list. Both must agree.
export const auth = firebaseAuth({
  adminEmails,
  credentials: {
    projectId: import.meta.env.FIREBASE_PROJECT_ID,
    clientEmail: import.meta.env.FIREBASE_CLIENT_EMAIL,
    privateKey: import.meta.env.FIREBASE_PRIVATE_KEY?.replace(/\\\\n/g, "\\n"),
  },
});
`;
}

const cmsTs = () => `import {
  createCmsEngine,
  restTransport,
  type CmsEngine,
  type ItemMap,
} from "better-content/core";

// The engine is framework-free: it holds the content, buffers edits, and
// talks to the routes under /api/admin. The component around it is just a
// binding, which is why the same setup works in React, Vue, and Svelte.
export function createEngine(initialItems: ItemMap): CmsEngine {
  return createCmsEngine({
    transport: restTransport({ apiBasePath: "/api/admin" }),
    initialItems,
  });
}
`;

const apiRoute = () => `import type { APIRoute } from "astro";
import { createCmsHandlers } from "better-content/server";
import { auth } from "../../../../lib/auth";
import { data } from "../../../../lib/data";

export const prerender = false;

// One factory call gives you the whole authenticated CRUD surface. The
// handlers speak web-standard Request/Response, so the same four lines work
// in Next.js, Nuxt, SvelteKit, Hono, or a bare worker.
const handlers = createCmsHandlers({ data, auth });

type Params = { collection: string; id: string };

const context = (params: Partial<Params>) => ({
  params: Promise.resolve(params as Params),
});

export const GET: APIRoute = ({ request, params }) =>
  handlers.GET(request, context(params));

export const PUT: APIRoute = ({ request, params }) =>
  handlers.PUT(request, context(params));

export const PATCH: APIRoute = ({ request, params }) =>
  handlers.PATCH(request, context(params));

export const DELETE: APIRoute = ({ request, params }) =>
  handlers.DELETE(request, context(params));
`;

function indexAstro({ framework, auth }) {
  const fw = FRAMEWORK[framework];
  const adminLink =
    auth === "token"
      ? `\n      <a class="admin-link" href="/admin">admin sign in</a>`
      : "";

  return `---
import { loadItemMap } from "better-content/server";
import Editable from "${fw.importPath}";
import { data } from "../lib/data";
import "../styles.css";

// Content is loaded on the server and handed to the island as a snapshot,
// so the first paint already has real text in it. The defaults only apply
// when the row is missing, which makes a fresh database render sensibly.
const initialItems = await loadItemMap(data, {
  sections: {
    defaults: [
      {
        id: "hero",
        heading: "Edit this heading",
        tagline:
          "And this tagline. Both are columns on a row in your own database.",
      },
    ],
    merge: "byId",
  },
});
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>better-content starter</title>
  </head>
  <body>
    <main>
      <Editable initialItems={initialItems} client:load />${adminLink}
    </main>
  </body>
</html>
`;
}

function editableReact() {
  return `import { useState } from "react";
import type { ItemMap } from "better-content/core";
import {
  AnonymousEditProvider,
  ContentEditSpan,
  PageProvider,
  useCmsAuth,
  usePageContext,
} from "better-content/react";
import { createEngine } from "../lib/cms";

function Editor() {
  const { isEditing, toggleEdit } = useCmsAuth();
  const { hasUnsavedChanges, saving, saveAll } = usePageContext();

  return (
    <article className="page">
      <ContentEditSpan
        as="h1"
        collection="sections"
        itemId="hero"
        fieldKey="heading"
      />
      <ContentEditSpan
        as="p"
        collection="sections"
        itemId="hero"
        fieldKey="tagline"
      />

      <div className="bar">
        <button onClick={toggleEdit} aria-pressed={isEditing}>
          {isEditing ? "Done" : "Edit"}
        </button>
        <button
          onClick={() => void saveAll()}
          disabled={!hasUnsavedChanges || saving}
        >
          {saving ? "Saving" : "Save"}
        </button>
      </div>
    </article>
  );
}

// Field edits buffer locally until Save; item operations (create, delete,
// reorder) would apply immediately and roll back if the server rejected them.
export default function Editable({ initialItems }: { initialItems: ItemMap }) {
  const [engine] = useState(() => createEngine(initialItems));

  return (
    <AnonymousEditProvider>
      <PageProvider engine={engine}>
        <Editor />
      </PageProvider>
    </AnonymousEditProvider>
  );
}
`;
}

function editableVue() {
  return `<script setup lang="ts">
import { ref } from "vue";
import type { ItemMap } from "better-content/core";
import { useCmsSnapshot, vContentEdit } from "better-content/vue";
import { createEngine } from "../lib/cms";

const props = defineProps<{ initialItems: ItemMap }>();

// Field edits buffer locally until Save; item operations (create, delete,
// reorder) would apply immediately and roll back if the server rejected them.
const engine = createEngine(props.initialItems);
const snapshot = useCmsSnapshot(engine);
const editing = ref(false);
</script>

<template>
  <article class="page">
    <h1
      v-content-edit="{
        engine,
        collection: 'sections',
        itemId: 'hero',
        fieldKey: 'heading',
        editing,
      }"
    ></h1>
    <p
      v-content-edit="{
        engine,
        collection: 'sections',
        itemId: 'hero',
        fieldKey: 'tagline',
        editing,
      }"
    ></p>

    <div class="bar">
      <button :aria-pressed="editing" @click="editing = !editing">
        {{ editing ? "Done" : "Edit" }}
      </button>
      <button
        :disabled="!snapshot.hasUnsavedChanges || snapshot.saving"
        @click="engine.saveAll()"
      >
        {{ snapshot.saving ? "Saving" : "Save" }}
      </button>
    </div>
  </article>
</template>
`;
}

function editableSvelte() {
  return `<script lang="ts">
  import type { ItemMap } from "better-content/core";
  import { contentEdit, engineStore } from "better-content/svelte";
  import { createEngine } from "../lib/cms";

  export let initialItems: ItemMap;

  // Field edits buffer locally until Save; item operations (create, delete,
  // reorder) would apply immediately and roll back if the server rejected them.
  const engine = createEngine(initialItems);
  const snapshot = engineStore(engine);
  let editing = false;
</script>

<article class="page">
  <h1
    use:contentEdit={{
      engine,
      collection: "sections",
      itemId: "hero",
      fieldKey: "heading",
      editing,
    }}
  ></h1>
  <p
    use:contentEdit={{
      engine,
      collection: "sections",
      itemId: "hero",
      fieldKey: "tagline",
      editing,
    }}
  ></p>

  <div class="bar">
    <button aria-pressed={editing} on:click={() => (editing = !editing)}>
      {editing ? "Done" : "Edit"}
    </button>
    <button
      disabled={!$snapshot.hasUnsavedChanges || $snapshot.saving}
      on:click={() => engine.saveAll()}
    >
      {$snapshot.saving ? "Saving" : "Save"}
    </button>
  </div>
</article>
`;
}

const loginRoute = () => `import type { APIRoute } from "astro";
import { ADMIN_COOKIE, verifyToken } from "../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");

  if (!verifyToken(token)) {
    return redirect("/admin?error=1", 303);
  }

  cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return redirect("/", 303);
};
`;

const adminPage = () => `---
import "../styles.css";

const failed = Astro.url.searchParams.has("error");
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sign in</title>
  </head>
  <body>
    <main>
      <form class="page" method="POST" action="/api/login">
        <h1>Admin sign in</h1>
        <p>
          Enter the value of <code>ADMIN_TOKEN</code> to enable saving. Without
          it you can still toggle edit mode and type, but writes are rejected.
        </p>
        {failed && <p class="error">That token did not match.</p>}
        <input
          type="password"
          name="token"
          placeholder="admin token"
          autocomplete="current-password"
          required
        />
        <div class="bar">
          <button type="submit">Sign in</button>
        </div>
      </form>
    </main>
  </body>
</html>
`;

const styles = () => `:root {
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

function readme({ framework, database, auth, name }) {
  const dbSetup =
    database === "postgres"
      ? `## 1. Point it at a database

Set \`DATABASE_URL\` in \`.env\`, then create the table:

\`\`\`sh
psql "$DATABASE_URL" -f schema.sql
\`\`\`

\`src/lib/schema.ts\` is the Drizzle definition of that same table, and it is
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

Set \`ADMIN_TOKEN\` in \`.env\` to anything unguessable, then visit
\`/admin\` and enter it. That sets an httpOnly cookie which
\`src/lib/auth.ts\` checks on every write, with a timing-safe comparison.

Anyone can toggle edit mode and type. Only requests carrying the cookie are
allowed to persist, and the check runs on the server where it cannot be
bypassed from the console.

This is deliberately the simplest gate that is still real. When you add
accounts, replace \`auth\` in \`src/lib/auth.ts\` with any \`AuthAdapter\`;
nothing else in the app changes.`
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

  const bindingNote = {
    react: `\`src/components/Editable.tsx\` uses \`ContentEditSpan\`, which reads edit
mode from context and commits drafts on blur. \`EditableImage\` and
\`useMarkdownEditor\` are available from the same import when you need them.`,
    vue: `\`src/components/Editable.vue\` uses the \`v-content-edit\` directive, which
renders the field value into the element and commits drafts on blur. Leave
those elements childless: the directive owns their text. \`useEditableImage\`
is available from the same import for image fields.`,
    svelte: `\`src/components/Editable.svelte\` uses the \`contentEdit\` action, which
renders the field value into the element and commits drafts on blur. Leave
those elements childless: the action owns their text. \`imageEdit\` is
available from the same import for image fields.`,
  }[framework];

  return `# ${name}

Inline editing wired to your own database, built with
[better-content](https://better-content-docs.vercel.app).

Astro hosts the app so the CMS routes and the initial content load can run on
the server, with a ${framework} island doing the editing. The engine itself is
framework-free, which is why the same setup works with any of the three
bindings.

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
| \`src/lib/data.ts\` | the only file that knows what your database is |
| \`src/lib/auth.ts\` | decides whether a request may write |
| \`src/lib/cms.ts\` | creates the engine and points it at the API routes |
| \`src/pages/api/admin/[collection]/[id].ts\` | the CRUD surface, from one factory call |
| \`src/pages/index.astro\` | loads content on the server, hands it to the island |
| \`src/components/${FRAMEWORK[framework].component}\` | the editable UI |

${bindingNote}

Field edits buffer locally and flush when you press Save. Item operations
(create, update, delete, reorder) apply immediately and roll back if the
server rejects them.

## 4. Deploy

\`npm run build\` emits a standalone Node server:

\`\`\`sh
npm run build
node ./dist/server/entry.mjs
\`\`\`

Set the same environment variables in your host. To deploy somewhere with a
platform-specific adapter (Vercel, Netlify, Cloudflare), swap
\`@astrojs/node\` in \`astro.config.mjs\` for that adapter.

The handlers speak web-standard Request/Response, so if you would rather live
in Next.js, Nuxt, SvelteKit, or a worker, the same \`createCmsHandlers\` call
moves over unchanged.
`;
}

export function buildFiles(answers) {
  const { framework, database, auth } = answers;
  const fw = FRAMEWORK[framework];

  const files = {
    "package.json": packageJson(answers),
    "astro.config.mjs": astroConfig(answers),
    "tsconfig.json": tsconfig(answers),
    ".gitignore": gitignore(),
    ".env.example": envExample(answers),
    "README.md": readme(answers),
    "src/env.d.ts": envTypes(answers),
    "src/styles.css": styles(),
    "src/lib/cms.ts": cmsTs(),
    "src/lib/data.ts": dataTs(answers),
    "src/lib/auth.ts": authTs(answers),
    "src/pages/index.astro": indexAstro(answers),
    "src/pages/api/admin/[collection]/[id].ts": apiRoute(),
  };

  files[`src/components/${fw.component}`] = {
    react: editableReact,
    vue: editableVue,
    svelte: editableSvelte,
  }[framework]();

  if (database === "postgres") {
    files["src/lib/schema.ts"] = schemaTs();
    files["schema.sql"] = schemaSql();
  }

  if (auth === "token") {
    files["src/pages/admin.astro"] = adminPage();
    files["src/pages/api/login.ts"] = loginRoute();
  }

  return files;
}
