import {
  BETTER_CONTENT,
  SVELTEKIT_ENV,
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
  value: "sveltekit",
  label: "SvelteKit",
  hint: "Svelte 5, runes",
  binding: "svelte",
  tailwind: true,
};

// The add-ons carry their own options, and every one of them has to be given
// explicitly: `--add tailwindcss` on its own still stops to ask which plugins
// you want, even with no TTY, which hangs the scaffold.
export function scaffold(directory, { tailwind }) {
  const args = [
    "sv@latest",
    "create",
    directory,
    "--template",
    "minimal",
    "--types",
    "ts",
    "--no-install",
    "--no-dir-check",
    "--no-download-check",
    "--add",
    "sveltekit-adapter=adapter:node",
  ];

  if (tailwind) args.push("--add", "tailwindcss=plugins:none");

  return npx(args);
}

export function dependencies(answers) {
  const server = serverDeps(answers);
  return {
    deps: { "better-content": BETTER_CONTENT, ...server.deps },
    devDeps: server.devDeps,
    // sv leaves the built server to `node build`; nothing in its scripts runs it.
    scripts: { start: "node build" },
  };
}

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

const attr = (name, value) => (value ? ` ${name}="${value}"` : "");
const line = (indent, name, value) =>
  value ? `\n${" ".repeat(indent)}${name}="${value}"` : "";

export function files(answers) {
  const { database, auth, name, tailwind } = answers;
  const { classes } = styleKit(tailwind);

  const out = {
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
npm run build
ORIGIN=https://your-domain.example npm start
\`\`\`

Set \`ORIGIN\` to the URL the app is served from. \`adapter-node\` compares
it against the origin of incoming form posts, and rejects them with a 403 when
it cannot tell, which would break the sign in page.

The adapter is configured in \`vite.config.ts\`, where \`sv\` put it. Swap
\`@sveltejs/adapter-node\` for \`adapter-vercel\`, \`adapter-netlify\`, or
\`adapter-cloudflare\` to deploy with a platform adapter instead; those set the
origin for you.`,
    }),

    "src/routes/layout.css": stylesheet(tailwind),

    // Same shape sv writes, kept so the stylesheet import is there whether or
    // not the Tailwind add-on ran.
    "src/routes/+layout.svelte": `<script lang="ts">
  import "./layout.css";
  import favicon from "$lib/assets/favicon.svg";

  let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{@render children()}
`,

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

  // The server load runs once per navigation and the engine owns the snapshot
  // from there on.
  // svelte-ignore state_referenced_locally
  const engine = createEngine(data.initialItems);
  const snapshot = engineStore(engine);
  let editing = $state(false);
</script>

<!-- contentEdit renders the field value into these elements, so they are
     intentionally empty here: the action owns their text. -->
<main${attr("class", classes.main)}>
  <article${attr("class", classes.page)}>
    <!-- svelte-ignore a11y_missing_content -->
    <h1${line(6, "class", classes.h1)}
      use:contentEdit={{
        engine,
        collection: "sections",
        itemId: "hero",
        fieldKey: "heading",
        editing,
      }}
    ></h1>
    <!-- svelte-ignore a11y_missing_content -->
    <p${line(6, "class", classes.p)}
      use:contentEdit={{
        engine,
        collection: "sections",
        itemId: "hero",
        fieldKey: "tagline",
        editing,
      }}
    ></p>

    <div${attr("class", classes.bar)}>
      <button${line(8, "class", classes.button)}
        aria-pressed={editing}
        onclick={() => (editing = !editing)}
      >
        {editing ? "Done" : "Edit"}
      </button>
      <button${line(8, "class", classes.button)}
        disabled={!$snapshot.hasUnsavedChanges || $snapshot.saving}
        onclick={() => engine.saveAll()}
      >
        {$snapshot.saving ? "Saving" : "Save"}
      </button>
    </div>
  </article>
${auth === "token" ? `  <a${attr("class", classes.link)} href="/admin">admin sign in</a>\n` : ""}</main>
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

<main${attr("class", classes.main)}>
  <form${attr("class", classes.page)} method="POST" action="/api/login">
    <h1${attr("class", classes.h1)}>Admin sign in</h1>
    <p${attr("class", classes.p)}>
      Enter the value of <code>ADMIN_TOKEN</code> to enable saving. Without it
      you can still toggle edit mode and type, but writes are rejected.
    </p>
    {#if failed}
      <p${attr("class", classes.error)}>That token did not match.</p>
    {/if}
    <input${line(6, "class", classes.input)}
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
`;
  }

  return out;
}
