# Adapters

## The read shape both adapters share

A read returns the record's **stored fields plus `id`**. An adapter neither
invents fields nor hides them, so the same record reads back the same way
whichever backend holds it:

```ts
{ id: "hero", title: "Hello", createdAt: "2026-09-06T…", updatedAt: "…" }
```

- **`id`** is the record's address, and so is the collection name. Neither is
  a field, and `collection` is not returned.
- **`createdAt` / `updatedAt`** are the adapter's own, written on every create
  and update, and both adapters return them.
- **Timestamps are ISO strings**, not `Date` objects, on both backends. These
  records are JSON-serialized across `createContentHandler` and server-rendered
  payloads, where a `Date` becomes a string anyway.
- An adapter **accepts back what it returned**: handing a record you just read
  to `createWithId` or `upsert` works, which is what makes copying one
  environment into another possible.

`seedItemMap` strips all four before writing, since they address the record or
belong to the adapter rather than being content.


## better-content/adapters/postgres

```ts
class PostgresDataAdapter implements DataAdapter {
  constructor(config: PostgresAdapterConfig);
}

interface PostgresAdapterConfig {
  db?: PgDatabase;                     // a Drizzle database (any pg driver)
  pool?: Pool;                         // or a pg Pool to build one from
  connectionString?: string;           // or a connection string
  schema: Record<string, PgTable>;     // collection name → Drizzle table (required)
}
```

Typed-only Drizzle adapter. You declare tables with `pgTable(...)` and own
migrations (Drizzle Kit); the adapter performs DML only.

- Throws on unregistered collections, undeclared fields (writes and
  filters), and unsupported query shapes.
- `contains` maps to `ILIKE '%value%'`; `in`/`nin` map to
  `inArray`/`notInArray`; OR groups are supported.
- Default ordering: `createdAt` descending when the column exists and no
  `orderBy` is given.
- `update`/`upsert` set `updatedAt = new Date()`.
- Reads return `createdAt`/`updatedAt` as ISO strings, and writes accept
  either those strings or a `Date`.
- `create` generates an id with `crypto.randomUUID` where available.
- `pg` and the node-postgres driver load lazily, only when the adapter must
  build its own pool; passing `db` works without `pg` installed, including
  in browsers (PGlite).

Peers: `drizzle-orm` >= 0.40, `pg` >= 8 (pool path only).

## better-content/adapters/firestore

```ts
class FirestoreDataAdapter implements DataAdapter {
  constructor(config?: FirestoreAdapterConfig);
}

interface FirestoreAdapterConfig {
  db?: Firestore;                      // existing admin Firestore instance
  credentials?: {                      // or service-account credentials
    projectId?: string;
    clientEmail?: string;
    privateKey?: string;
    databaseURL?: string;
  };
  defaultOrderByField?: string;        // default "createdAt"
}
```

Operator mapping: `eq ==`, `ne !=`, `lt <`, `lte <=`, `gt >`, `gte >=`,
`in in`, `nin not-in`.

- **Throws** on `contains` (no native substring search) and on OR filter
  groups; the errors say so explicitly.
- Firestore Timestamps serialize to ISO strings in results.
- `create`/`createWithId` stamp `createdAt` and `updatedAt`;
  `update`/`upsert` refresh `updatedAt` (`upsert` merges).
- `createWithId` uses Firestore's `create`, so it **rejects an id that already
  exists** rather than overwriting it. Use `upsert` to write regardless, or
  `delete` then `createWithId` to replace a document.
- Because reads order by `createdAt` and Firestore omits documents that lack
  the ordering field, records written only through `upsert` can be missing
  from an unfiltered read. `createWithId` stamps `createdAt`, so seeding
  through it (or through `delete` + `createWithId`) avoids this.
- With no query, reads order by `defaultOrderByField` descending.

Peer: `firebase-admin` >= 12 (uses the modular `firebase-admin/app` and
`firebase-admin/firestore` APIs).
