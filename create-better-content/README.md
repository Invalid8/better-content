# create-better-content

Scaffold an app with inline editing wired to your own database.

```sh
npm create better-content@latest
```

Answer three questions and you get a running app: click text on the page,
type, save, and the write lands in your database through
[better-content](https://better-content-docs.vercel.app).

## What it asks

First, the framework:

| | |
|---|---|
| **Next.js, Nuxt, SvelteKit, Astro** | full-stack: the app serves its own CMS routes |
| **React, Vue, Svelte** | plain Vite apps with no server of their own |

The rest of the questions follow from that, because the two cases have
genuinely different answers:

| Full-stack | Client only |
|---|---|
| Where content lives: Postgres or Firestore | Where writes go: an API you already run, or Postgres in the browser (PGlite) |
| How writes are gated: admin token or Firebase | nothing to ask, because a browser cannot hold credentials or gate anything |

It also asks whether you want Tailwind CSS, and generates the editable page
with Tailwind utilities or a small stylesheet to match.

Pick Astro and it asks one more thing: which framework to use for the island
(React, Vue, or Svelte).

The client-only apps use `AnonymousEditProvider`, so visitors get a local edit
toggle without the app pretending they are an admin. Choosing "an API you
already run" means you gate the writes there; choosing PGlite means the whole
database lives in the tab and there is nothing to gate.

Skip the prompts with flags. Note the `--`: npm reads anything before it as
its own flags, and `-f` is npm's `--force`.

```sh
npm create better-content@latest my-site -- -f next -d postgres -a token
```

`npx` passes flags straight through, so it needs no separator:

```sh
npx create-better-content my-site -f sveltekit -d postgres -a token
```

`-y` accepts defaults for anything you leave out, which makes it usable in
scripts and CI.

## What it generates

A project that looks like what that framework's community expects, not a
lowest-common-denominator shell. A Next.js app has `app/`, route handlers, and
a server component; a SvelteKit app has `+page.server.ts` and `+server.ts`; a
Nuxt app has `server/api` and Nitro handlers.

Every framework is scaffolded by its own official CLI, and better-content is
added to the result:

| Framework | Runs |
|---|---|
| Next.js | `create-next-app` |
| Nuxt | `nuxi init` |
| SvelteKit | `sv create` |
| Astro | `create-astro` |
| React, Vue, Svelte | `create-vite` |

So you get that CLI's own options and current versions rather than this
package's copy of them, and `npx shadcn@latest init` works afterwards because
what you have is a real Next, Nuxt, SvelteKit, Astro, or Vite app.

What they share is the part that belongs to better-content, and it stays small
in every one of them:

| File | Job |
|---|---|
| `data.ts` | the only file that knows what your database is |
| `auth.ts` | decides whether a request may write |
| `cms.ts` | creates the engine, points it at the API routes |

The CRUD surface is one factory call. In Next.js the whole route file is:

```ts
export const { GET, PUT, PATCH, DELETE } = createCmsHandlers({ data, auth });
```

because a Next route handler is `(Request, { params })` with params as a
promise, which is exactly what the factory returns. The other hosts need a
couple of lines to forward the request; the CMS layer is identical.

Nothing is hidden in a framework wrapper: every file is yours, and the parts
that touch your data are three small modules you can read in a minute.

## Requirements

Node 18 or newer. The CLI itself has zero dependencies.

MIT. Part of the [better-content](https://github.com/Invalid8/better-content)
project.
