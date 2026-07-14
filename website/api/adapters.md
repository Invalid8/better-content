# Adapters

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
- With no query, reads order by `defaultOrderByField` descending.

Peer: `firebase-admin` >= 12 (uses the modular `firebase-admin/app` and
`firebase-admin/firestore` APIs).
