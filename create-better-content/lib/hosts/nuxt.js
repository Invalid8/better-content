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
import { editConfig, npx } from "../run.js";

export const meta = {
  value: "nuxt",
  label: "Nuxt",
  hint: "Vue 3, Nitro server",
  binding: "vue",
  tailwind: true,
};

// nuxi refuses to pick a template for you without a TTY, so name it. The rest
// of the flags keep the install and the git repo out of our way.
export async function scaffold(directory, { tailwind }) {
  await npx([
    "nuxi@latest",
    "init",
    directory,
    "--template",
    "minimal",
    "--no-install",
    "--no-gitInit",
    "--packageManager",
    "npm",
  ]);

  // Nuxt has no first-party Tailwind 4 command: the module on nuxi is still
  // the v3 one. Tailwind's own Nuxt guide is this Vite plugin plus the
  // @import, which the stylesheet we write already carries.
  const options = `  css: ["~/assets/css/main.css"],
  nitro: {
    // Database drivers stay external so Nitro does not try to bundle their
    // native bits into the server output.
    externals: { external: ["pg", "firebase-admin"] },
  },${tailwind ? "\n  vite: { plugins: [tailwindcss()] }," : ""}`;

  await editConfig(directory, "nuxt.config.ts", {
    factory: "defineNuxtConfig",
    imports: tailwind ? ["import tailwindcss from '@tailwindcss/vite'"] : [],
    options,
  });
}

export function dependencies({ tailwind, ...answers }) {
  const server = serverDeps(answers);
  return {
    deps: { "better-content": BETTER_CONTENT, ...server.deps },
    devDeps: {
      ...server.devDeps,
      ...(tailwind
        ? { tailwindcss: "^4.3.3", "@tailwindcss/vite": "^4.3.3" }
        : {}),
    },
  };
}

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

const attr = (name, value) => (value ? ` ${name}="${value}"` : "");
const line = (indent, name, value) =>
  value ? `\n${" ".repeat(indent)}${name}="${value}"` : "";

export function files(answers) {
  const { database, auth, name, tailwind } = answers;
  const { classes } = styleKit(tailwind);

  const out = {
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

    "app/assets/css/main.css": stylesheet(tailwind),

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
  <!-- v-content-edit renders the field value into these elements, so they are
       intentionally empty here: the directive owns their text. -->
  <main${attr("class", classes.main)}>
    <article${attr("class", classes.page)}>
      <h1${line(8, "class", classes.h1)}
        v-content-edit="{
          engine,
          collection: 'sections',
          itemId: 'hero',
          fieldKey: 'heading',
          editing,
        }"
      ></h1>
      <p${line(8, "class", classes.p)}
        v-content-edit="{
          engine,
          collection: 'sections',
          itemId: 'hero',
          fieldKey: 'tagline',
          editing,
        }"
      ></p>

      <div${attr("class", classes.bar)}>
        <button${line(10, "class", classes.button)}
          :aria-pressed="editing"
          @click="editing = !editing"
        >
          {{ editing ? "Done" : "Edit" }}
        </button>
        <button${line(10, "class", classes.button)}
          :disabled="!snapshot.hasUnsavedChanges || snapshot.saving"
          @click="engine.saveAll()"
        >
          {{ snapshot.saving ? "Saving" : "Save" }}
        </button>
      </div>
    </article>
${auth === "token" ? `    <a${attr("class", classes.link)} href="/admin">admin sign in</a>\n` : ""}  </main>
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
  <main${attr("class", classes.main)}>
    <form${attr("class", classes.page)} method="POST" action="/api/login">
      <h1${attr("class", classes.h1)}>Admin sign in</h1>
      <p${attr("class", classes.p)}>
        Enter the value of <code>ADMIN_TOKEN</code> to enable saving. Without it
        you can still toggle edit mode and type, but writes are rejected.
      </p>
      <p v-if="failed"${attr("class", classes.error)}>That token did not match.</p>
      <input${line(8, "class", classes.input)}
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
</template>
`;
  }

  return out;
}
