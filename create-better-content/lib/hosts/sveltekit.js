import {
  BETTER_CONTENT,
  SVELTEKIT_ENV,
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
  value: "sveltekit",
  label: "SvelteKit",
  hint: "Svelte 5, runes",
  binding: "svelte",
};

const layout = {
  dataPath: "src/lib/data.ts",
  authPath: "src/lib/auth.ts",
  schemaPath: "`src/lib/schema.ts`",
  routePath: "src/routes/api/admin/[collection]/[id]/+server.ts",
  pagePath: "src/routes/+page.server.ts",
  componentPath: "src/routes/+page.svelte",
};

const bindingNote = `\`src/routes/+page.svelte\` uses the \`contentEdit\` action, which renders the
field value into the element and commits drafts on blur. Leave those elements
childless: the action owns their text. \`imageEdit\` comes from the same import
for image fields. The load function stays on the server, so the database never
reaches the browser bundle.`;

export function files(answers) {
  const { database, auth, name } = answers;

  const deps = { "better-content": BETTER_CONTENT };
  const devDeps = {
    "@sveltejs/adapter-node": "^5.5.7",
    "@sveltejs/kit": "^2.70.1",
    "@sveltejs/vite-plugin-svelte": "^7.2.0",
    svelte: "^5.56.5",
    "svelte-check": "^4.4.1",
    typescript: "^5.9.3",
    vite: "^8.1.5",
  };
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
          dev: "vite dev",
          build: "vite build",
          preview: "vite preview",
          start: "node build",
          check: "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
        },
        dependencies: sorted(deps),
        devDependencies: sorted(devDeps),
      },
      null,
      2,
    )}\n`,

    "svelte.config.js": `import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
  kit: { adapter: adapter() },
};
`,

    "vite.config.ts": `import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
});
`,

    "tsconfig.json": `${JSON.stringify(
      {
        extends: "./.svelte-kit/tsconfig.json",
        compilerOptions: {
          allowJs: true,
          checkJs: true,
          esModuleInterop: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          skipLibCheck: true,
          sourceMap: true,
          strict: true,
          moduleResolution: "bundler",
        },
      },
      null,
      2,
    )}\n`,

    ".gitignore": gitignore([".svelte-kit/", "build/"]),
    ".env.example": `${envExample(answers)}
# adapter-node checks the request origin before accepting a form POST. Without
# this, the /admin sign in returns 403 in production.
ORIGIN=http://localhost:3000
`,
    "README.md": readme({
      host: { label: "SvelteKit", bindingNote },
      database,
      auth,
      name,
      layout,
      deploy: `\`\`\`sh
ORIGIN=https://your-domain.example npm start
\`\`\`

Set \`ORIGIN\` to the URL the app is served from. \`adapter-node\` compares
it against the origin of incoming form posts, and rejects them with a 403 when
it cannot tell, which would break the sign in page.

Swap \`@sveltejs/adapter-node\` in \`svelte.config.js\` for
\`adapter-vercel\`, \`adapter-netlify\`, or \`adapter-cloudflare\` to deploy
with a platform adapter instead; those set the origin for you.`,
    }),

    "src/app.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
`,

    "src/app.css": styles(),

    "src/lib/data.ts": dataModule(answers, SVELTEKIT_ENV),
    "src/lib/auth.ts": authModule(answers, SVELTEKIT_ENV),
    "src/lib/cms.ts": `import {
  createCmsEngine,
  restTransport,
  type CmsEngine,
  type ItemMap,
} from "better-content/core";

// The engine is framework-free: it holds the content, buffers edits, and
// talks to the endpoints under /api/admin.
export function createEngine(initialItems: ItemMap): CmsEngine {
  return createCmsEngine({
    transport: restTransport({ apiBasePath: "/api/admin" }),
    initialItems,
  });
}
`,

    "src/routes/+layout.svelte": `<script lang="ts">
  import "../app.css";

  let { children } = $props();
</script>

{@render children()}
`,

    "src/routes/+page.server.ts": `import { loadItemMap } from "better-content/server";
import { data } from "$lib/data";
import type { PageServerLoad } from "./$types";

// Runs only on the server, so the database driver never reaches the browser.
// The defaults apply only when the row is missing, which makes a fresh
// database render sensibly instead of blank.
export const load: PageServerLoad = async () => ({
  initialItems: await loadItemMap(data, {
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
});
`,

    "src/routes/+page.svelte": `<script lang="ts">
  import { contentEdit, engineStore } from "better-content/svelte";
  import { createEngine } from "$lib/cms";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const engine = createEngine(data.initialItems);
  const snapshot = engineStore(engine);
  let editing = $state(false);
</script>

<main>
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
  </article>
${auth === "token" ? `  <a class="admin-link" href="/admin">admin sign in</a>\n` : ""}</main>
`,

    "src/routes/api/admin/[collection]/[id]/+server.ts": `import { createCmsHandlers } from "better-content/server";
import { auth } from "$lib/auth";
import { data } from "$lib/data";
import type { RequestHandler } from "./$types";

// SvelteKit hands params synchronously; the handlers want them as a promise.
// That wrapper is the entire integration.
const handlers = createCmsHandlers({ data, auth });

const context = (params: { collection: string; id: string }) => ({
  params: Promise.resolve(params),
});

export const GET: RequestHandler = ({ request, params }) =>
  handlers.GET(request, context(params));

export const PUT: RequestHandler = ({ request, params }) =>
  handlers.PUT(request, context(params));

export const PATCH: RequestHandler = ({ request, params }) =>
  handlers.PATCH(request, context(params));

export const DELETE: RequestHandler = ({ request, params }) =>
  handlers.DELETE(request, context(params));
`,
  };

  if (database === "postgres") {
    out["src/lib/schema.ts"] = schemaModule();
    out["schema.sql"] = schemaSql();
  }

  if (auth === "token") {
    out["src/routes/api/login/+server.ts"] = `import { redirect } from "@sveltejs/kit";
import { ADMIN_COOKIE, verifyToken } from "$lib/auth";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, cookies }) => {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");

  if (!verifyToken(token)) {
    redirect(303, "/admin?error=1");
  }

  cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect(303, "/");
};
`;

    out["src/routes/admin/+page.svelte"] = `<script lang="ts">
  import { page } from "$app/state";

  const failed = $derived(page.url.searchParams.has("error"));
</script>

<main>
  <form class="page" method="POST" action="/api/login">
    <h1>Admin sign in</h1>
    <p>
      Enter the value of <code>ADMIN_TOKEN</code> to enable saving. Without it
      you can still toggle edit mode and type, but writes are rejected.
    </p>
    {#if failed}
      <p class="error">That token did not match.</p>
    {/if}
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
`;
  }

  return out;
}
