import { BETTER_CONTENT, styleKit, stylesheet } from "../shared.js";
import { editConfig, npx, removeFiles } from "../run.js";

// Client-only apps, scaffolded by create-vite. There is no server here, so
// there is nothing to hold database credentials and no gate to run: either you
// point the engine at an API you already run (and gate it there), or you keep
// the whole database in the browser with PGlite.

const FRAMEWORKS = {
  react: {
    label: "React",
    hint: "Vite, client only",
    template: "react-ts",
    appFile: "src/App.tsx",
    editorFile: "src/App.tsx",
    styleFile: "src/index.css",
    // create-vite's demo page lives in these; the app that rendered it is gone.
    demoFiles: ["src/App.css", "src/assets"],
  },
  vue: {
    label: "Vue",
    hint: "Vite, client only",
    template: "vue-ts",
    appFile: "src/App.vue",
    editorFile: "src/Editor.vue",
    styleFile: "src/style.css",
    demoFiles: ["src/components", "src/assets"],
  },
  svelte: {
    label: "Svelte",
    hint: "Vite, client only",
    template: "svelte-ts",
    appFile: "src/App.svelte",
    editorFile: "src/Editor.svelte",
    styleFile: "src/app.css",
    demoFiles: ["src/lib", "src/assets"],
  },
};

// PGlite ships a WASM build that must not be pre-bundled, and the Postgres
// adapter lazy-imports "pg" for its node path, which never runs in a browser.
const PGLITE_VITE_OPTIONS = `  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  build: {
    // The Postgres adapter lazy-imports "pg" for a path that never runs in a
    // browser. Leave it external so the bundler stops looking for it.
    rollupOptions: { external: ["pg"] },
  },`;

// styleKit leaves some slots empty (Tailwind needs no class where the plain
// stylesheet has one), so emit the attribute only when it would carry a value.
const attr = (name, value) => (value ? ` ${name}="${value}"` : "");

// The same, for tags whose attributes are already one per line. Tailwind class
// lists are long enough that inlining them makes the markup unreadable.
const line = (indent, name, value) =>
  value ? `\n${" ".repeat(indent)}${name}="${value}"` : "";

function scaffold(framework, directory, { tailwind, transport }) {
  const fw = FRAMEWORKS[framework];

  return (async () => {
    await npx([
      "create-vite@latest",
      directory,
      "--template",
      fw.template,
      "--no-immediate",
      "--no-interactive",
    ]);

    await removeFiles(directory, fw.demoFiles);

    // create-vite offers no Tailwind option, so this is the one place we add a
    // framework feature rather than delegate it. In v4 that is a Vite plugin
    // plus one @import, and the stylesheet we write already carries the import.
    const imports = [];
    const plugins = [];
    if (tailwind) {
      // Single quotes, no semicolon: the file we are editing is create-vite's.
      imports.push("import tailwindcss from '@tailwindcss/vite'");
      plugins.push("tailwindcss()");
    }

    const options = transport === "pglite" ? PGLITE_VITE_OPTIONS : "";
    if (imports.length || options) {
      await editConfig(directory, "vite.config.ts", { imports, plugins, options });
    }
  })();
}

function dependencies({ transport, tailwind }) {
  const deps = { "better-content": BETTER_CONTENT };
  const devDeps = {};

  if (transport === "pglite") {
    deps["@electric-sql/pglite"] = "^0.5.4";
    deps["drizzle-orm"] = "^0.45.2";
  }

  if (tailwind) {
    devDeps.tailwindcss = "^4.3.3";
    devDeps["@tailwindcss/vite"] = "^4.3.3";
  }

  return { deps, devDeps };
}

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
  fetchItemMap,
  restTransport,
  type CmsEngine,
  type ItemMap,
} from "better-content/core";

// This app has no server of its own, which is the point: it talks to an API
// you already run. A browser can never be trusted with credentials, so the
// admin check has to live where you control it.
//
// That API needs two routes, and it is worth knowing why. A transport only
// writes, so createCmsHandlers alone would leave this app able to save edits
// it could never display: reload and you would be back to the seed below.
// createContentHandler is the read half.
const apiBasePath = import.meta.env.VITE_API_BASE_PATH ?? "/api/admin";
const contentUrl = import.meta.env.VITE_CONTENT_URL ?? "/api/content";

// Only used until the read endpoint answers, so the app runs before you have
// built one. Once it does, this is dead weight and can go.
const seed: ItemMap = ${SEED};

export const ready: Promise<CmsEngine> = (async () => {
  let initialItems = seed;

  try {
    initialItems = await fetchItemMap(contentUrl);
  } catch (error) {
    console.warn(
      \`[cms] could not read \${contentUrl}, falling back to seed content.\`,
      error,
    );
  }

  return createCmsEngine({
    transport: restTransport({ apiBasePath }),
    initialItems,
  });
})();
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

function appFiles(framework, transport, tailwind) {
  const { classes } = styleKit(tailwind);
  const persisted =
    transport === "pglite"
      ? "Reload the page and your edits are still there: they are rows in a real Postgres running in this tab."
      : "Saving sends the changes to your API, which decides whether to accept them.";

  if (framework === "react") {
    return {
      "src/App.tsx": `import { useEffect, useState } from "react";
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

      <p${attr("className", classes.note)}>${persisted}</p>
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

  if (!engine) {
    return (
      <main${attr("className", classes.main)}>
        <p${attr("className", classes.note)}>Starting the engine…</p>
      </main>
    );
  }

  return (
    <AnonymousEditProvider>
      <PageProvider engine={engine}>
        <main${attr("className", classes.main)}>
          <Editor />
        </main>
      </PageProvider>
    </AnonymousEditProvider>
  );
}
`,
    };
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
  <main${attr("class", classes.main)}>
    <Editor v-if="engine" :engine="engine" />
    <p v-else${attr("class", classes.note)}>Starting the engine…</p>
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

    <p${attr("class", classes.note)}>${persisted}</p>
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

<main${attr("class", classes.main)}>
  {#await ready}
    <p${attr("class", classes.note)}>Starting the engine…</p>
  {:then engine}
    <Editor {engine} />
  {/await}
</main>
`,
    "src/Editor.svelte": `<script lang="ts">
  import type { CmsEngine } from "better-content/core";
  import { contentEdit, engineStore } from "better-content/svelte";

  let { engine }: { engine: CmsEngine } = $props();

  // The engine is handed over once, after it resolves, and never swapped.
  // svelte-ignore state_referenced_locally
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

  <p${attr("class", classes.note)}>${persisted}</p>
</article>
`,
  };
}

function buildFiles(framework, answers) {
  const { transport = "rest", tailwind, name } = answers;
  const fw = FRAMEWORKS[framework];

  const out = {
    [fw.styleFile]: stylesheet(tailwind),
    "src/cms.ts": cmsModule(transport),
    ...appFiles(framework, transport, tailwind),
  };

  if (transport === "pglite") {
    out["src/schema.ts"] = schemaModule();
  } else {
    out[".env.example"] = `# Where your better-content API is mounted. It must be an API you run,
# because this app is client only and cannot hold credentials itself.

# Writes: createCmsHandlers, gated on your side.
VITE_API_BASE_PATH=/api/admin

# Reads: createContentHandler, public. Without this the app can save edits it
# cannot display.
VITE_CONTENT_URL=/api/content
`;
  }

  out["README.md"] = readmeFor(framework, transport, tailwind, name, fw);

  return out;
}

function readmeFor(framework, transport, tailwind, name, fw) {
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

There is no server in this project, on purpose. \`src/cms.ts\` talks to an API
you run: \`VITE_API_BASE_PATH\` for writes, \`VITE_CONTENT_URL\` for reads.

You need **both** routes on that API. A transport only writes, so mounting the
admin handlers alone leaves this app able to save edits it can never display:
reload and you are back to the seed in \`src/cms.ts\`.

\`\`\`ts
// Writes. Gate these. (Next.js: src/app/api/admin/[collection]/[id]/route.ts)
import { createCmsHandlers } from "better-content/server";

export const { GET, PUT, PATCH, DELETE } = createCmsHandlers({ data, auth });
\`\`\`

\`\`\`ts
// Reads. Public. (Next.js: src/app/api/content/route.ts)
import { createContentHandler } from "better-content/server";

export const { GET } = createContentHandler({
  data,
  collections: {
    sections: {
      defaults: [{ id: "hero", heading: "Edit this heading" }],
      merge: "byId",
    },
  },
});
\`\`\`

The read route is public because it only returns the content the page already
shows. The write route is not.

**Gate the writes on that side.** This app uses \`AnonymousEditProvider\`, which
gives visitors a local edit toggle without claiming they are an admin. Nothing
in a browser can decide whether a write is allowed, so the server has to.

Until the read route exists, \`src/cms.ts\` logs a warning and falls back to its
seed content, so the app still runs.`;

  const binding =
    framework === "react"
      ? "`ContentEditSpan` reads edit mode from context and commits drafts on blur; `EditableImage` and `useMarkdownEditor` come from the same import."
      : framework === "vue"
        ? "The `v-content-edit` directive renders the field value into the element and commits drafts on blur; `useEditableImage` handles image fields."
        : "The `contentEdit` action renders the field value into the element and commits drafts on blur; `imageEdit` handles image fields.";

  return `# ${name}

Inline editing in a plain ${fw.label} app, built with
[better-content](https://better-content-docs.vercel.app).

\`\`\`sh
npm install${transport === "pglite" ? "" : "\ncp .env.example .env"}
npm run dev
\`\`\`

The project itself came from \`create-vite\`, so its build, TypeScript, and
lint setup are the ones Vite ships and documents.${
    tailwind
      ? " Tailwind CSS v4 is wired\nin through `@tailwindcss/vite`, which means `npx shadcn@latest init` works\nfrom here."
      : ""
  }

${how}

## The editable parts

\`${fw.editorFile}\` holds the UI. ${binding}

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
    tailwind: true,
  },
  scaffold: (directory, settings) => scaffold(value, directory, settings),
  dependencies,
  files: (answers) => buildFiles(value, answers),
}));
