import {
  BETTER_CONTENT,
  authModule,
  databaseDeps,
  dataModule,
  envExample,
  gitignore,
  readme,
  schemaModule,
  schemaSql,
  sorted,
  styles,
} from "../shared.js";

export const meta = {
  value: "nuxt",
  label: "Nuxt",
  hint: "Vue 3, Nitro server",
  binding: "vue",
};

const layout = {
  dataPath: "server/lib/data.ts",
  authPath: "server/lib/auth.ts",
  schemaPath: "`server/lib/schema.ts`",
  routePath: "server/api/admin/[collection]/[id].ts",
  pagePath: "server/api/content.get.ts",
  componentPath: "app/pages/index.vue",
};

const bindingNote = `\`app/pages/index.vue\` uses the \`v-content-edit\` directive, which renders the
field value into the element and commits drafts on blur. Leave those elements
childless: the directive owns their text. \`useEditableImage\` comes from the
same import for image fields.

Nuxt renders pages on both server and client, so the initial content comes
from \`server/api/content.get.ts\` rather than being read inline. That keeps
the database driver in the Nitro bundle and out of the browser.`;

export function files(answers) {
  const { database, auth, name } = answers;

  const deps = {
    "better-content": BETTER_CONTENT,
    nuxt: "^4.5.0",
    vue: "^3.5.39",
    "vue-router": "^4.5.0",
  };
  const devDeps = { typescript: "^5.9.3" };
  const db = databaseDeps(database);
  Object.assign(deps, db.deps);
  Object.assign(devDeps, db.devDeps);

  const out = {
    "package.json": `${JSON.stringify(
      {
        name,
        private: true,
        type: "module",
        scripts: {
          dev: "nuxt dev",
          build: "nuxt build",
          preview: "nuxt preview",
          postinstall: "nuxt prepare",
        },
        dependencies: sorted(deps),
        devDependencies: sorted(devDeps),
      },
      null,
      2,
    )}\n`,

    "nuxt.config.ts": `export default defineNuxtConfig({
  compatibilityDate: "2025-07-01",
  css: ["~/assets/css/main.css"],
  nitro: {
    // Database drivers stay external so Nitro does not try to bundle their
    // native bits into the server output.
    externals: { external: ["pg", "firebase-admin"] },
  },
});
`,

    "tsconfig.json": `${JSON.stringify({ extends: "./.nuxt/tsconfig.json" }, null, 2)}\n`,

    ".gitignore": gitignore([".nuxt/", ".output/", ".data/"]),
    ".env.example": envExample(answers),
    "README.md": readme({
      host: { label: "Nuxt", bindingNote },
      database,
      auth,
      name,
      layout,
      deploy: `\`\`\`sh
npm run build
node .output/server/index.mjs
\`\`\`

Nitro detects most platforms automatically at build time, so deploying to
Vercel, Netlify, or Cloudflare usually needs no configuration change.`,
    }),

    "app/app.vue": `<template>
  <NuxtPage />
</template>
`,

    "app/assets/css/main.css": styles(),

    "app/utils/cms.ts": `import {
  createCmsEngine,
  restTransport,
  type CmsEngine,
  type ItemMap,
} from "better-content/core";

// The engine is framework-free: it holds the content, buffers edits, and
// talks to the Nitro routes under /api/admin.
export function createEngine(initialItems: ItemMap): CmsEngine {
  return createCmsEngine({
    transport: restTransport({ apiBasePath: "/api/admin" }),
    initialItems,
  });
}
`,

    "app/pages/index.vue": `<script setup lang="ts">
import type { ItemMap } from "better-content/core";
import { useCmsSnapshot, vContentEdit } from "better-content/vue";
import { createEngine } from "~/utils/cms";

const { data: initialItems } = await useFetch<ItemMap>("/api/content");

const engine = createEngine(initialItems.value ?? {});
const snapshot = useCmsSnapshot(engine);
const editing = ref(false);
</script>

<template>
  <main>
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
${auth === "token" ? `    <a class="admin-link" href="/admin">admin sign in</a>\n` : ""}  </main>
</template>
`,

    "server/lib/data.ts": dataModule(answers),
    "server/lib/auth.ts": authModule(answers),

    "server/api/content.get.ts": `import { loadItemMap } from "better-content/server";
import { data } from "~~/server/lib/data";

// Public read of the initial snapshot. Writes go through /api/admin, which is
// gated; this route only ever reads. The defaults apply when the row is
// missing, so a fresh database renders sensibly instead of blank.
export default defineEventHandler(async () =>
  loadItemMap(data, {
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
  }),
);
`,

    "server/api/admin/[collection]/[id].ts": `import { createCmsHandlers } from "better-content/server";
import { auth } from "~~/server/lib/auth";
import { data } from "~~/server/lib/data";

// Nitro speaks h3 events; the handlers speak web-standard Request/Response.
// toWebRequest bridges the two, and the method picks the handler.
const handlers = createCmsHandlers({ data, auth });

export default defineEventHandler(async (event) => {
  const method = event.method as keyof typeof handlers;
  const handler = handlers[method];

  if (typeof handler !== "function") {
    return new Response("Method not allowed", { status: 405 });
  }

  return handler(toWebRequest(event), {
    params: Promise.resolve({
      collection: getRouterParam(event, "collection") ?? "",
      id: getRouterParam(event, "id") ?? "",
    }),
  });
});
`,
  };

  if (database === "postgres") {
    out["server/lib/schema.ts"] = schemaModule();
    out["schema.sql"] = schemaSql();
  }

  if (auth === "token") {
    out["server/api/login.post.ts"] = `import { ADMIN_COOKIE, verifyToken } from "~~/server/lib/auth";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ token?: string }>(event);
  const token = String(body?.token ?? "");

  if (!verifyToken(token)) {
    return sendRedirect(event, "/admin?error=1", 303);
  }

  setCookie(event, ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return sendRedirect(event, "/", 303);
});
`;

    out["app/pages/admin.vue"] = `<script setup lang="ts">
const route = useRoute();
const failed = computed(() => "error" in route.query);
</script>

<template>
  <main>
    <form class="page" method="POST" action="/api/login">
      <h1>Admin sign in</h1>
      <p>
        Enter the value of <code>ADMIN_TOKEN</code> to enable saving. Without it
        you can still toggle edit mode and type, but writes are rejected.
      </p>
      <p v-if="failed" class="error">That token did not match.</p>
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
</template>
`;
  }

  return out;
}
