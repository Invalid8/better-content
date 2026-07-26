import { BETTER_CONTENT, gitignore, sorted, styles } from "../shared.js";

// Client-only apps. There is no server here, so there is nothing to hold
// database credentials and no gate to run: either you point the engine at an
// API you already run (and gate it there), or you keep the whole database in
// the browser with PGlite.

const FRAMEWORKS = {
  react: {
    label: "React",
    hint: "Vite, client only",
    appFile: "src/App.tsx",
    mainFile: "src/main.tsx",
    mount: "root",
    deps: { react: "^19.2.7", "react-dom": "^19.2.7" },
    devDeps: {
      "@types/react": "^19.2.17",
      "@types/react-dom": "^19.2.3",
      "@vitejs/plugin-react": "^5.0.4",
    },
    plugin: { import: 'import react from "@vitejs/plugin-react";', call: "react()" },
    tsconfigExtra: { jsx: "react-jsx" },
  },
  vue: {
    label: "Vue",
    hint: "Vite, client only",
    appFile: "src/App.vue",
    mainFile: "src/main.ts",
    mount: "app",
    deps: { vue: "^3.5.39" },
    devDeps: { "@vitejs/plugin-vue": "^6.0.1", "vue-tsc": "^2.2.0" },
    plugin: { import: 'import vue from "@vitejs/plugin-vue";', call: "vue()" },
    tsconfigExtra: {},
  },
  svelte: {
    label: "Svelte",
    hint: "Vite, client only",
    appFile: "src/App.svelte",
    mainFile: "src/main.ts",
    mount: "app",
    deps: { svelte: "^5.56.5" },
    devDeps: {
      "@sveltejs/vite-plugin-svelte": "^7.2.0",
      "svelte-check": "^4.4.1",
    },
    plugin: {
      import: 'import { svelte } from "@sveltejs/vite-plugin-svelte";',
      call: "svelte()",
    },
    tsconfigExtra: {},
  },
};

const SEED = `{
  sections: [
    {
      id: "hero",
      heading: "Edit this heading",
      tagline:
        "And this tagline. Both live wherever your transport puts them.",
    },
  ],
}`;

function cmsModule(transport) {
  if (transport === "pglite") {
    return `import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { PostgresDataAdapter } from "better-content/adapters/postgres";
import {
  adapterTransport,
  createCmsEngine,
  type CmsEngine,
} from "better-content/core";
import { loadItemMap } from "better-content/server";
import { DDL, SEED, schema } from "./schema";

// Postgres compiled to WebAssembly, kept in IndexedDB. There is no server and
// no network hop: adapterTransport drives the DataAdapter directly, which is
// the same seam a REST backend would sit behind.
const client = new PGlite("idb://better-content");

const adapter = new PostgresDataAdapter({
  db: drizzle(client, { schema }) as never,
  schema: schema as never,
});

export const ready: Promise<CmsEngine> = (async () => {
  await client.exec(DDL);

  const existing = await client.query<{ n: number }>(
    "select count(*)::int as n from sections",
  );
  if ((existing.rows[0]?.n ?? 0) === 0) {
    await client.exec(SEED);
  }

  return createCmsEngine({
    transport: adapterTransport(adapter),
    initialItems: await loadItemMap(adapter, { sections: {} }),
  });
})();
`;
  }

  return `import {
  createCmsEngine,
  restTransport,
  type CmsEngine,
  type ItemMap,
} from "better-content/core";

// This app has no server of its own, which is the point: it talks to an API
// you already run. Mount createCmsHandlers there (see the docs) and gate the
// writes on that side. A browser can never be trusted with credentials, so
// the admin check has to live where you control it.
const apiBasePath = import.meta.env.VITE_API_BASE_PATH ?? "/api/admin";

// The engine just needs a snapshot to start from. Replace this with a fetch
// from your own read endpoint once you have one.
const initialItems: ItemMap = ${SEED};

export const ready: Promise<CmsEngine> = Promise.resolve(
  createCmsEngine({
    transport: restTransport({ apiBasePath }),
    initialItems,
  }),
);
`;
}

const schemaModule = () => `import { integer, pgTable, text } from "drizzle-orm/pg-core";

// You own this schema. The adapter is typed-only: it reads and writes exactly
// the columns declared here and throws on anything else.
export const sections = pgTable("sections", {
  id: text("id").primaryKey(),
  heading: text("heading"),
  tagline: text("tagline"),
  order: integer("order"),
});

export const schema = { sections };

export const DDL = \`
  create table if not exists sections (
    id      text primary key,
    heading text,
    tagline text,
    "order" integer
  );
\`;

export const SEED = \`
  insert into sections (id, heading, tagline, "order") values
    ('hero',
     'Edit this heading',
     'And this tagline. Both are rows in Postgres, running in this tab.',
     0);
\`;
`;

function appFiles(framework, transport) {
  const persisted =
    transport === "pglite"
      ? "Reload the page and your edits are still there: they are rows in a real Postgres running in this tab."
      : "Saving sends the changes to your API, which decides whether to accept them.";

  if (framework === "react") {
    return { "src/App.tsx": `import { useEffect, useState } from "react";
import type { CmsEngine } from "better-content/core";
import {
  AnonymousEditProvider,
  ContentEditSpan,
  PageProvider,
  useCmsAuth,
  usePageContext,
} from "better-content/react";
import { ready } from "./cms";

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

      <p className="note">${persisted}</p>
    </article>
  );
}

// AnonymousEditProvider gives visitors a local edit toggle without claiming
// they are an admin. Nothing here decides whether a write is allowed.
export default function App() {
  const [engine, setEngine] = useState<CmsEngine | null>(null);

  useEffect(() => {
    void ready.then(setEngine);
  }, []);

  if (!engine) return <main><p className="note">Starting the engine…</p></main>;

  return (
    <AnonymousEditProvider>
      <PageProvider engine={engine}>
        <main>
          <Editor />
        </main>
      </PageProvider>
    </AnonymousEditProvider>
  );
}
` };
  }

  if (framework === "vue") {
    return {
      "src/App.vue": `<script setup lang="ts">
import { onMounted, shallowRef } from "vue";
import type { CmsEngine } from "better-content/core";
import Editor from "./Editor.vue";
import { ready } from "./cms";

// The engine resolves asynchronously, so the editor waits for it rather than
// dealing with a null engine everywhere.
const engine = shallowRef<CmsEngine | null>(null);

onMounted(async () => {
  engine.value = await ready;
});
</script>

<template>
  <main>
    <Editor v-if="engine" :engine="engine" />
    <p v-else class="note">Starting the engine…</p>
  </main>
</template>
`,
      "src/Editor.vue": `<script setup lang="ts">
import { ref } from "vue";
import type { CmsEngine } from "better-content/core";
import { useCmsSnapshot, vContentEdit } from "better-content/vue";

const props = defineProps<{ engine: CmsEngine }>();

const snapshot = useCmsSnapshot(props.engine);
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

    <p class="note">${persisted}</p>
  </article>
</template>
`,
    };
  }

  return {
    "src/App.svelte": `<script lang="ts">
  import Editor from "./Editor.svelte";
  import { ready } from "./cms";
</script>

<main>
  {#await ready}
    <p class="note">Starting the engine…</p>
  {:then engine}
    <Editor {engine} />
  {/await}
</main>
`,
    "src/Editor.svelte": `<script lang="ts">
  import type { CmsEngine } from "better-content/core";
  import { contentEdit, engineStore } from "better-content/svelte";

  let { engine }: { engine: CmsEngine } = $props();

  const snapshot = engineStore(engine);
  let editing = $state(false);
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
    <button aria-pressed={editing} onclick={() => (editing = !editing)}>
      {editing ? "Done" : "Edit"}
    </button>
    <button
      disabled={!$snapshot.hasUnsavedChanges || $snapshot.saving}
      onclick={() => engine.saveAll()}
    >
      {$snapshot.saving ? "Saving" : "Save"}
    </button>
  </div>

  <p class="note">${persisted}</p>
</article>
`,
  };
}

function mainFile(framework) {
  if (framework === "react") {
    return `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;
  }

  if (framework === "vue") {
    return `import { createApp } from "vue";
import App from "./App.vue";
import "./styles.css";

createApp(App).mount("#app");
`;
  }

  return `import { mount } from "svelte";
import App from "./App.svelte";
import "./styles.css";

export default mount(App, { target: document.getElementById("app")! });
`;
}

function buildFiles(framework, answers) {
  const { transport = "rest", name } = answers;
  const fw = FRAMEWORKS[framework];

  const deps = { "better-content": BETTER_CONTENT, ...fw.deps };
  const devDeps = { typescript: "^5.9.3", vite: "^8.1.5", ...fw.devDeps };

  if (transport === "pglite") {
    devDeps["@electric-sql/pglite"] = "^0.5.4";
    devDeps["drizzle-orm"] = "^0.45.0";
  }

  const out = {
    "package.json": `${JSON.stringify(
      {
        name,
        private: true,
        type: "module",
        scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
        dependencies: sorted(deps),
        devDependencies: sorted(devDeps),
      },
      null,
      2,
    )}\n`,

    "vite.config.ts": `import { defineConfig } from "vite";
${fw.plugin.import}

export default defineConfig({
  plugins: [${fw.plugin.call}],${
    transport === "pglite"
      ? `
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  build: {
    // The Postgres adapter lazy-imports "pg" for its node path, which never
    // runs in a browser. Leave it external so the bundler stops looking.
    rollupOptions: { external: ["pg"] },
  },`
      : ""
  }
});
`,

    "tsconfig.json": `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          isolatedModules: true,
          resolveJsonModule: true,
          ...fw.tsconfigExtra,
        },
        include: ["src"],
      },
      null,
      2,
    )}\n`,

    "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>better-content starter</title>
  </head>
  <body>
    <div id="${fw.mount}"></div>
    <script type="module" src="/${fw.mainFile}"></script>
  </body>
</html>
`,

    ".gitignore": gitignore([]),
    "src/styles.css": `${styles()}
.note {
  color: var(--muted);
  font-size: 0.85rem;
  margin-top: 1.25rem;
}
`,
    "src/cms.ts": cmsModule(transport),
    [fw.mainFile]: mainFile(framework),
    ...appFiles(framework, transport),
  };

  if (transport === "pglite") {
    out["src/schema.ts"] = schemaModule();
  } else {
    out[".env.example"] = `# Where your better-content API is mounted. It must be an API you run,
# because this app is client only and cannot hold credentials itself.
VITE_API_BASE_PATH=/api/admin
`;
  }

  out["README.md"] = readmeFor(framework, transport, name, fw);

  return out;
}

function readmeFor(framework, transport, name, fw) {
  const how =
    transport === "pglite"
      ? `## How it works

There is no server. \`src/cms.ts\` runs Postgres compiled to WebAssembly
(PGlite) in the browser, keeps it in IndexedDB, and drives it through
\`adapterTransport\`, which talks to a \`DataAdapter\` directly with no HTTP
hop. Reload the page and your edits are still there.

That makes this a real local-first app, and also the fastest way to see the
engine work without provisioning anything. When you outgrow it, swap
\`adapterTransport\` for \`restTransport\` and move the adapter to a server:
the components do not change.`
      : `## How it works

There is no server in this project, on purpose. \`src/cms.ts\` points
\`restTransport\` at \`VITE_API_BASE_PATH\`, so writes go to an API you run.

Mount the handlers there:

\`\`\`ts
import { createCmsHandlers } from "better-content/server";

export const { GET, PUT, PATCH, DELETE } = createCmsHandlers({ data, auth });
\`\`\`

**Gate the writes on that side.** This app uses \`AnonymousEditProvider\`, which
gives visitors a local edit toggle without claiming they are an admin. Nothing
in a browser can decide whether a write is allowed, so the server has to.`;

  return `# ${name}

Inline editing in a plain ${fw.label} app, built with
[better-content](https://better-content-docs.vercel.app).

\`\`\`sh
npm install${transport === "pglite" ? "" : "\ncp .env.example .env"}
npm run dev
\`\`\`

${how}

## The editable parts

\`${fw.appFile}\` holds the UI. ${
    framework === "react"
      ? "`ContentEditSpan` reads edit mode from context and commits drafts on blur; `EditableImage` and `useMarkdownEditor` come from the same import."
      : framework === "vue"
        ? "The `v-content-edit` directive renders the field value into the element and commits drafts on blur; `useEditableImage` handles image fields."
        : "The `contentEdit` action renders the field value into the element and commits drafts on blur; `imageEdit` handles image fields."
  }

Field edits buffer locally and flush when you press Save. Item operations
(create, update, delete, reorder) apply immediately and roll back if the write
is rejected.

## Build

\`\`\`sh
npm run build
\`\`\`

The output is static files: host them anywhere.
`;
}

export const hosts = Object.entries(FRAMEWORKS).map(([value, fw]) => ({
  meta: {
    value,
    label: fw.label,
    hint: fw.hint,
    clientOnly: true,
  },
  files: (answers) => buildFiles(value, answers),
}));
