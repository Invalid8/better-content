# create-better-content

Scaffold an app with inline editing wired to your own database.

```sh
npm create better-content@latest
```

Answer three questions and you get a running app: click text on the page,
type, save, and the write lands in your database through
[better-content](https://better-content-docs.vercel.app).

## What it asks

| Question | Options |
|---|---|
| Framework binding | React, Vue, Svelte |
| Where content lives | Postgres (Drizzle), Firestore |
| How writes are gated | Admin token, Firebase |

Skip the prompts with flags. Note the `--`: npm reads anything before it as
its own flags, and `-f` is npm's `--force`.

```sh
npm create better-content@latest my-site -- -f svelte -d postgres -a token
```

`npx` passes flags straight through, so it needs no separator:

```sh
npx create-better-content my-site -f svelte -d postgres -a token
```

`-y` accepts defaults for anything you leave out, which makes it usable in
scripts and CI.

## What it generates

An [Astro](https://astro.build) app with your framework as an island. Astro
hosts all three bindings as first-class citizens and gives the CMS routes a
server to run on, so one template shape covers every answer instead of three
divergent starters.

```
src/lib/data.ts      the only file that knows what your database is
src/lib/auth.ts      decides whether a request may write
src/lib/cms.ts       creates the engine, points it at the API routes
src/pages/api/admin/[collection]/[id].ts   the CRUD surface, one factory call
src/pages/index.astro                      server-loads content, hands it to the island
src/components/Editable.{tsx,vue,svelte}   the editable UI
```

Nothing is hidden in a framework wrapper: every file is yours, and the parts
that touch your data are three small modules you can read in a minute.

The handlers speak web-standard Request/Response, so if you would rather live
in Next.js, Nuxt, SvelteKit, or a worker, the same `createCmsHandlers` call
moves over unchanged. The generated README covers the schema, the gate, and
deployment.

## Requirements

Node 18 or newer. The CLI itself has zero dependencies.

MIT. Part of the [better-content](https://github.com/Invalid8/better-content)
project.
