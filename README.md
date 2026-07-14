<p align="center">
  <img src="https://raw.githubusercontent.com/Invalid8/better-content/main/logo.svg" alt="better-content — a page of text with one line highlighted by an editor's marker" width="88" height="88" />
</p>

# better-content

[![CI](https://github.com/Invalid8/better-content/actions/workflows/ci.yml/badge.svg)](https://github.com/Invalid8/better-content/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/better-content)](https://www.npmjs.com/package/better-content)

Own-your-data, adapter-driven, framework-agnostic inline-edit CMS engine. MIT.

**[Try the live demo](https://better-content-playground.vercel.app/)**: edit
the page in your browser, every field persists to a real Postgres running in
your tab.

[![17-second demo: toggling edit mode, typing into the page, saving, and inspecting the database](https://raw.githubusercontent.com/Invalid8/better-content/main/assets/demo.gif)](https://better-content-playground.vercel.app/)

Edit content directly on your live pages. Changes persist to **your** database
through a small adapter seam, with no hosted service, no lock-in, and no
proprietary backend. The engine is a framework-free external store; React is
the first binding.

> **Status: pre-1.0.** The API is still settling; minor versions may break
> until 1.0. Two adapters (Postgres, Firestore), one storage provider
> (Cloudinary), and one auth provider (Firebase) ship as proof of the seams.

## Why

- **Own your data** — content lives in your Postgres/Firestore, queried through
  a 7-method `DataAdapter` you can implement in an afternoon.
- **DB-backed, not git-backed** — unlike git-based CMSes, content is rows, so
  it works for apps, not just static sites.
- **Framework-agnostic core** — the engine is `getSnapshot()`/`subscribe()`
  (the same seam Zustand and Redux use). `better-content/core` imports zero
  framework code; bindings are thin adapters.
- **Inline editing as the primary UX** — headless `contentEditable` primitives
  with `data-cms-*` styling hooks. No admin panel required.
- **Transport-agnostic** — the engine speaks a 3-method `Transport`
  (`save`/`patch`/`remove`). REST ships as the default; swap in tRPC, server
  actions, or a direct adapter without touching the engine.

## Install

```sh
npm install better-content
```

React, database drivers, and SDKs are **optional peer dependencies** — install
only what you use (`react`, `drizzle-orm` + `pg`, `firebase-admin`, `firebase`,
`cloudinary`).

## Quickstart (React + REST)

**1. Wrap your page and make a field editable:**

```tsx
import { restTransport } from "better-content/core";
import {
  AnonymousEditProvider,
  ContentEditSpan,
  PageProvider,
} from "better-content/react";

export default function Page({ initialItems }) {
  return (
    <AnonymousEditProvider>
      <PageProvider transport={restTransport()} initialItems={initialItems}>
        <ContentEditSpan as="h1" collection="sections" itemId="hero" fieldKey="heading" />
      </PageProvider>
    </AnonymousEditProvider>
  );
}
```

**2. Mount the API (Next.js App Router shown; any Request/Response runtime works):**

```ts
// app/api/admin/[collection]/[id]/route.ts
import { createCmsHandlers } from "better-content/server";
import { PostgresDataAdapter } from "better-content/adapters/postgres";
import { firebaseAuth } from "better-content/auth/firebase";
import { schema } from "@/db/schema";

export const { GET, PATCH, PUT, DELETE } = createCmsHandlers({
  data: new PostgresDataAdapter({ connectionString: process.env.DATABASE_URL, schema }),
  auth: firebaseAuth({ adminEmails: ["you@example.com"] }),
});
```

**3. Load initial content on the server:**

```ts
import { loadItemMap } from "better-content/server";

const initialItems = await loadItemMap(data, {
  sections: { defaults: [{ id: "hero", heading: "Hello" }], merge: "byId" },
});
```

Toggle edit mode, click the text, type, save. Field edits are **deferred**
(buffered locally, flushed by `saveAll`); item operations
(create/update/delete/reorder) are **immediate and optimistic** with rollback.

## Subpath exports

| Import | What | Runs on |
|---|---|---|
| `better-content/core` | engine, `Transport` (`restTransport`, `inMemoryTransport`), types | anywhere |
| `better-content/react` | `PageProvider`, `ContentEditSpan`, `EditableImage`, `useMarkdownEditor`, auth context | client |
| `better-content/server` | `createCmsHandlers`, `createAdminGate`, `loadItemMap`, `resolveRelations` | server |
| `better-content/adapters/postgres` | Drizzle-backed, typed-only adapter | server |
| `better-content/adapters/firestore` | Firestore adapter (throws on unsupported ops) | server |
| `better-content/storage/cloudinary` | client upload half (pure fetch) | client |
| `better-content/storage/cloudinary/server` | signature endpoint half | server |
| `better-content/auth/firebase` | request verification (`AuthAdapter`) | server |
| `better-content/auth/firebase/client` | `FirebaseAuthProvider` + `useFirebaseAuth` | client |

Client subpaths never import server SDKs — safe to bundle.

## Adapters

**Postgres** is typed-only: every collection is a Drizzle `pgTable` you declare
and migrate yourself (Drizzle Kit). Writes to undeclared fields or unregistered
collections throw. No JSONB fallback, no hidden DDL.

**Firestore** maps the neutral query ops it can honor natively and **throws**
on the rest (`contains`, OR groups) rather than silently misleading.

Bring your own backend by implementing `DataAdapter` — 7 methods
(`fetchById`, `fetchCollection`, `create`, `createWithId`, `update`, `upsert`,
`delete`) against a neutral `Query`.

## Auth

Server: an `AuthAdapter` resolves a request to an identity; `createAdminGate`
rejects non-admins (401 with `{ logout: true }`, or 403). Firebase ships
built-in: `admin` custom claim **and** an email allowlist must agree.

Client: `AnonymousEditProvider` lets visitors toggle edit mode locally on a
live site while every write stays gated server-side — try-before-you-buy
editing with zero risk.

## Development

```sh
npm test          # vitest (in-memory transport + PGlite — no infra needed)
npm run build     # tsup: ESM + CJS + .d.ts per subpath
```

The `examples/playground` Vite app runs the full stack (engine → REST →
handlers → Postgres-on-PGlite) with `npm run dev` and zero external services.

## License & positioning

MIT. **Independent project** — not affiliated with better-auth or the better-*
family; it shares their values: own your data, framework-agnostic,
TypeScript-first, MIT.
