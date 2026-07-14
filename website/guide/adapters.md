# Database adapters

Adapters implement the 7-method `DataAdapter` seam, and the server handlers
and loaders only ever speak to that interface. Two ship with the package;
bringing your own is deliberately small.

## The neutral query language

Reads accept a backend-neutral `Query` so no database's native query type
leaks through the seam:

```ts
const rows = await data.fetchCollection("posts", {
  filters: [
    { field: "status", op: "eq", value: "live" },
    { or: [
      { field: "tag", op: "eq", value: "react" },
      { field: "tag", op: "eq", value: "sql" },
    ]},
  ],
  orderBy: [{ field: "createdAt", direction: "desc" }],
  limit: 20,
  offset: 40,
});
```

Operators: `eq ne lt lte gt gte in nin contains`. Top-level filters combine
with AND; `{ or: [...] }` groups combine their contents with OR. `contains`
is a case-insensitive substring match.

**Adapters that cannot honor an operator throw.** A CMS that silently
returns wrong rows is worse than one that fails loudly; you find out in
development, not in production data.

## Postgres (Drizzle)

```ts
import { PostgresDataAdapter } from "better-content/adapters/postgres";
import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

const posts = pgTable("posts", {
  id: text("id").primaryKey(),
  title: text("title"),
  order: integer("order"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

const data = new PostgresDataAdapter({
  connectionString: process.env.DATABASE_URL, // or pool, or db
  schema: { posts },                          // collection name → table
});
```

The design is **typed-only**: every collection is a Drizzle table you
declare and migrate yourself (Drizzle Kit owns DDL). There is no JSONB
fallback and no catch-all column. In exchange you get real columns, real
types, and real indexes. The adapter enforces the contract:

- an unregistered collection throws,
- writing a field that has no column throws,
- filtering on an unknown field throws.

Details worth knowing:

- `contains` maps to `ILIKE '%value%'`.
- With no `orderBy`, results default to `createdAt` descending when the
  table has that column.
- `update` and `upsert` set `updatedAt` automatically.
- Connection: pass a Drizzle `db` (any Postgres driver, including PGlite and
  Neon), a `pg` Pool, or a connection string. The `pg` driver is loaded
  lazily only when the adapter has to build its own pool, so passing `db`
  needs no `pg` install and works in browsers.

Peers: `drizzle-orm` (always) and `pg` (only for pool/connection-string
usage).

## Firestore

```ts
import { FirestoreDataAdapter } from "better-content/adapters/firestore";

const data = new FirestoreDataAdapter({
  credentials: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  },
  // or db: an existing admin Firestore instance
});
```

Maps the neutral operators onto Firestore's (`eq` to `==`, `nin` to
`not-in`, and so on). Two operations have no honest Firestore equivalent and
**throw**: `contains` (no native substring search) and OR groups. If your
queries need them, use a backend with richer queries or split the read.

Firestore Timestamps serialize to ISO strings on the way out, so API
responses are plain JSON. `create`/`createWithId` stamp `createdAt` and
`updatedAt`; `update`/`upsert` refresh `updatedAt`. With no query, reads
default to `createdAt` descending (configurable via `defaultOrderByField`).

Peer: `firebase-admin`.

## Writing your own

Implement seven methods against your storage and every part of the system
(route factory, loaders, relations, devtools, adapterTransport) works with
it:

```ts
import type { DataAdapter } from "better-content/core";

export class MyAdapter implements DataAdapter {
  async fetchCollection(collection, query) { ... }
  async fetchById(collection, id) { ... }
  async create(collection, data) { ... }
  async createWithId(collection, id, data) { ... }
  async update(collection, id, partial) { ... }
  async upsert(collection, id, partial) { ... }
  async delete(collection, id) { ... }
}
```

Guidelines learned from the shipped two:

- return items as plain JSON with an `id` string,
- throw on query operators you cannot honor,
- treat `upsert` as create-or-replace addressed by id; deferred saves depend
  on it,
- keep timestamps your concern, not the engine's.
