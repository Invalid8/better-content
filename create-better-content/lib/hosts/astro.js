import {
  BETTER_CONTENT,
  authModule,
  dataModule,
  envExample,
  readme,
  schemaModule,
  schemaSql,
  serverDeps,
  styleKit,
  stylesheet,
} from "../shared.js";
import { npx } from "../run.js";

export const meta = {
  value: "astro",
  label: "Astro",
  hint: "islands, pick your framework",
  tailwind: true,
};

const BINDINGS = {
  react: { integration: "react", component: "Editable.tsx", importPath: "../components/Editable" },
  vue: { integration: "vue", component: "Editable.vue", importPath: "../components/Editable.vue" },
  svelte: {
    integration: "svelte",
    component: "Editable.svelte",
    importPath: "../components/Editable.svelte",
  },
};

// One call covers the island integration, the adapter and Tailwind, each at
// whatever version is current, and leaves astro.config.mjs and tsconfig.json
// correctly wired. Nothing here needs editing afterwards.
//
// Unlike the other hosts this one installs while it runs, because `astro add`
// refuses to work without dependencies present. Hardcoding the integration
// versions to avoid that would reintroduce exactly the drift being removed.
export function scaffold(directory, { binding = "react", tailwind }) {
  const add = [BINDINGS[binding].integration, "node"];
  if (tailwind) add.push("tailwind");

  return npx([
    "create-astro@latest",
    directory,
    "--template",
    "minimal",
    "--add",
    add.join(","),
    "--no-git",
    "--no-ai",
    "--skip-houston",
    "--yes",
  ]);
}

export function dependencies(answers) {
  const server = serverDeps(answers);
  return {
    deps: { "better-content": BETTER_CONTENT, ...server.deps },
    devDeps: server.devDeps,
  };
}

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

const attr = (name, value) => (value ? ` ${name}="${value}"` : "");
const line = (indent, name, value) =>
  value ? `\n${" ".repeat(indent)}${name}="${value}"` : "";

function editable(binding, classes) {
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
    <article${attr("className", classes.page)}>
      <ContentEditSpan
        as="h1"${line(8, "className", classes.h1)}
        collection="sections"
        itemId="hero"
        fieldKey="heading"
      />
      <ContentEditSpan
        as="p"${line(8, "className", classes.p)}
        collection="sections"
        itemId="hero"
        fieldKey="tagline"
      />

      <div${attr("className", classes.bar)}>
        <button${line(10, "className", classes.button)}
          onClick={toggleEdit}
          aria-pressed={isEditing}
        >
          {isEditing ? "Done" : "Edit"}
        </button>
        <button${line(10, "className", classes.button)}
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
  <!-- v-content-edit renders the field value into these elements, so they are
       intentionally empty here: the directive owns their text. -->
  <article${attr("class", classes.page)}>
    <h1${line(6, "class", classes.h1)}
      v-content-edit="{
        engine,
        collection: 'sections',
        itemId: 'hero',
        fieldKey: 'heading',
        editing,
      }"
    ></h1>
    <p${line(6, "class", classes.p)}
      v-content-edit="{
        engine,
        collection: 'sections',
        itemId: 'hero',
        fieldKey: 'tagline',
        editing,
      }"
    ></p>

    <div${attr("class", classes.bar)}>
      <button${line(8, "class", classes.button)}
        :aria-pressed="editing"
        @click="editing = !editing"
      >
        {{ editing ? "Done" : "Edit" }}
      </button>
      <button${line(8, "class", classes.button)}
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

  let { initialItems }: { initialItems: ItemMap } = $props();

  // The snapshot the server rendered is handed over once and never swapped.
  // svelte-ignore state_referenced_locally
  const engine = createEngine(initialItems);
  const snapshot = engineStore(engine);
  let editing = $state(false);
</script>

<!-- contentEdit renders the field value into these elements, so they are
     intentionally empty here: the action owns their text. -->
<article${attr("class", classes.page)}>
  <!-- svelte-ignore a11y_missing_content -->
  <h1${line(4, "class", classes.h1)}
    use:contentEdit={{
      engine,
      collection: "sections",
      itemId: "hero",
      fieldKey: "heading",
      editing,
    }}
  ></h1>
  <!-- svelte-ignore a11y_missing_content -->
  <p${line(4, "class", classes.p)}
    use:contentEdit={{
      engine,
      collection: "sections",
      itemId: "hero",
      fieldKey: "tagline",
      editing,
    }}
  ></p>

  <div${attr("class", classes.bar)}>
    <button${line(6, "class", classes.button)}
      aria-pressed={editing}
      onclick={() => (editing = !editing)}
    >
      {editing ? "Done" : "Edit"}
    </button>
    <button${line(6, "class", classes.button)}
      disabled={!$snapshot.hasUnsavedChanges || $snapshot.saving}
      onclick={() => engine.saveAll()}
    >
      {$snapshot.saving ? "Saving" : "Save"}
    </button>
  </div>
</article>
`;
}

export function files(answers) {
  const { database, auth, name, binding = "react", tailwind } = answers;
  const bind = BINDINGS[binding];
  const { classes } = styleKit(tailwind);

  const layout = {
    dataPath: "src/lib/data.ts",
    authPath: "src/lib/auth.ts",
    schemaPath: "`src/lib/schema.ts`",
    routePath: "src/pages/api/admin/[collection]/[id].ts",
    pagePath: "src/pages/index.astro",
    componentPath: `src/components/${bind.component}`,
  };

  const out = {
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

That uses \`@astrojs/node\`, which \`create-astro\` wired up. Swap it in
\`astro.config.mjs\` for the Vercel, Netlify, or Cloudflare adapter to deploy
with a platform adapter.`,
    }),

    "src/styles/global.css": stylesheet(tailwind),
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

    [`src/components/${bind.component}`]: editable(binding, classes),

    "src/pages/index.astro": `---
import { loadItemMap } from "better-content/server";
import Editable from "${bind.importPath}";
import { data } from "../lib/data";
import "../styles/global.css";

// This page reads the database on every request, so it cannot be prerendered.
export const prerender = false;

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
    <main${attr("class", classes.main)}>
      <Editable initialItems={initialItems} client:load />
${auth === "token" ? `      <a${attr("class", classes.link)} href="/admin">admin sign in</a>\n` : ""}    </main>
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
import "../styles/global.css";

export const prerender = false;

const failed = Astro.url.searchParams.has("error");
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sign in</title>
  </head>
  <body>
    <main${attr("class", classes.main)}>
      <form${attr("class", classes.page)} method="POST" action="/api/login">
        <h1${attr("class", classes.h1)}>Admin sign in</h1>
        <p${attr("class", classes.p)}>
          Enter the value of <code>ADMIN_TOKEN</code> to enable saving. Without
          it you can still toggle edit mode and type, but writes are rejected.
        </p>
        {failed && <p${attr("class", classes.error)}>That token did not match.</p>}
        <input${line(10, "class", classes.input)}
          type="password"
          name="token"
          placeholder="admin token"
          autocomplete="current-password"
          required
        />
        <div${attr("class", classes.bar)}>
          <button${attr("class", classes.button)} type="submit">Sign in</button>
        </div>
      </form>
    </main>
  </body>
</html>
`;
  }

  return out;
}
