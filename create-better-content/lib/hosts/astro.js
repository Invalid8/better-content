import {
  BETTER_CONTENT,
  authModule,
  dataModule,
  envExample,
  gitignore,
  readme,
  schemaModule,
  schemaSql,
  serverDeps,
  sorted,
  styles,
} from "../shared.js";

export const meta = {
  value: "astro",
  label: "Astro",
  hint: "islands, pick your framework",
  needsBinding: true,
};

const BINDINGS = {
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

const NOTES = {
  react: `\`src/components/Editable.tsx\` uses \`ContentEditSpan\`, which reads edit mode
from context and commits drafts on blur. \`EditableImage\` and
\`useMarkdownEditor\` come from the same import when you need them.`,
  vue: `\`src/components/Editable.vue\` uses the \`v-content-edit\` directive, which
renders the field value into the element and commits drafts on blur. Leave
those elements childless: the directive owns their text.`,
  svelte: `\`src/components/Editable.svelte\` uses the \`contentEdit\` action, which
renders the field value into the element and commits drafts on blur. Leave
those elements childless: the action owns their text.`,
};

function editable(binding) {
  if (binding === "react") {
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

  if (binding === "vue") {
    return `<script setup lang="ts">
import { ref } from "vue";
import type { ItemMap } from "better-content/core";
import { useCmsSnapshot, vContentEdit } from "better-content/vue";
import { createEngine } from "../lib/cms";

const props = defineProps<{ initialItems: ItemMap }>();

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

  return `<script lang="ts">
  import type { ItemMap } from "better-content/core";
  import { contentEdit, engineStore } from "better-content/svelte";
  import { createEngine } from "../lib/cms";

  export let initialItems: ItemMap;

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

export function files(answers) {
  const { database, auth, name, binding = "react" } = answers;
  const bind = BINDINGS[binding];

  const layout = {
    dataPath: "src/lib/data.ts",
    authPath: "src/lib/auth.ts",
    schemaPath: "`src/lib/schema.ts`",
    routePath: "src/pages/api/admin/[collection]/[id].ts",
    pagePath: "src/pages/index.astro",
    componentPath: `src/components/${bind.component}`,
  };

  const deps = {
    "@astrojs/node": "^11.0.2",
    [bind.integration]: bind.integrationVersion,
    astro: "^7.0.9",
    "better-content": BETTER_CONTENT,
    ...bind.deps,
  };
  const devDeps = { typescript: "^5.9.3", ...bind.devDeps };
  const server = serverDeps(answers);
  Object.assign(deps, server.deps);
  Object.assign(devDeps, server.devDeps);

  const out = {
    "package.json": `${JSON.stringify(
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
    )}\n`,

    "astro.config.mjs": `import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import ${binding} from "${bind.integration}";

export default defineConfig({
  // The CMS routes and the initial content load both run on the server.
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [${binding}()],
});
`,

    "tsconfig.json": `${JSON.stringify(
      {
        extends: "astro/tsconfigs/strict",
        include: [".astro/types.d.ts", "**/*"],
        exclude: ["dist"],
        ...(binding === "react"
          ? { compilerOptions: { jsx: "react-jsx", jsxImportSource: "react" } }
          : {}),
      },
      null,
      2,
    )}\n`,

    ".gitignore": gitignore([".astro/"]),
    ".env.example": envExample(answers),
    "README.md": readme({
      host: { label: `Astro (${binding} island)`, bindingNote: NOTES[binding] },
      database,
      auth,
      name,
      layout,
      deploy: `\`\`\`sh
npm run build
node ./dist/server/entry.mjs
\`\`\`

That uses \`@astrojs/node\`. Swap it in \`astro.config.mjs\` for the Vercel,
Netlify, or Cloudflare adapter to deploy with a platform adapter.`,
    }),

    "src/env.d.ts": `/// <reference types="astro/client" />\n`,
    "src/styles.css": styles(),
    "src/lib/data.ts": dataModule(answers),
    "src/lib/auth.ts": authModule(answers),
    "src/lib/cms.ts": `import {
  createCmsEngine,
  restTransport,
  type CmsEngine,
  type ItemMap,
} from "better-content/core";

// The engine is framework-free: it holds the content, buffers edits, and
// talks to the routes under /api/admin.
export function createEngine(initialItems: ItemMap): CmsEngine {
  return createCmsEngine({
    transport: restTransport({ apiBasePath: "/api/admin" }),
    initialItems,
  });
}
`,

    [`src/components/${bind.component}`]: editable(binding),

    "src/pages/index.astro": `---
import { loadItemMap } from "better-content/server";
import Editable from "${bind.importPath}";
import { data } from "../lib/data";
import "../styles.css";

// Read on the server and handed to the island as a snapshot, so the first
// paint already has real text in it. Defaults apply only when the row is
// missing, which makes a fresh database render sensibly.
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
      <Editable initialItems={initialItems} client:load />
${auth === "token" ? `      <a class="admin-link" href="/admin">admin sign in</a>\n` : ""}    </main>
  </body>
</html>
`,

    "src/pages/api/admin/[collection]/[id].ts": `import type { APIRoute } from "astro";
import { createCmsHandlers } from "better-content/server";
import { auth } from "../../../../lib/auth";
import { data } from "../../../../lib/data";

export const prerender = false;

// Astro hands params synchronously; the handlers want them as a promise.
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
`,
  };

  if (database === "postgres") {
    out["src/lib/schema.ts"] = schemaModule();
    out["schema.sql"] = schemaSql();
  }

  if (auth === "token") {
    out["src/pages/api/login.ts"] = `import type { APIRoute } from "astro";
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

    out["src/pages/admin.astro"] = `---
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
  }

  return out;
}
