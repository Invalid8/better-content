# Transports

The engine persists through a three-method seam:

```ts
interface Transport {
  save(collection: string, id: string, item: Item): Promise<void>;    // upsert
  patch(collection: string, id: string, partial: Record<string, unknown>): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
}
```

Three methods is the complete list of things the engine ever does to
persistence: deferred saves upsert whole items, immediate updates and
reorders patch, deletes remove. Reordering is intentionally not its own
method; it persists as one `patch` of the `order` field per item.

## restTransport (the default choice)

```ts
import { restTransport } from "better-content/core";

const transport = restTransport({ apiBasePath: "/api/admin" }); // default path shown
```

Maps the seam onto HTTP verbs against `{apiBasePath}/{collection}/{id}`:

| Method | Verb | Body |
|---|---|---|
| `save` | PUT | the whole item |
| `patch` | PATCH | the partial |
| `remove` | DELETE | none |

Path segments are URL-encoded. Non-2xx responses throw, which feeds the
engine's rollback and notification paths. Pair it with `createCmsHandlers`
on the server, which speaks exactly this shape.

## adapterTransport (no HTTP hop)

```ts
import { adapterTransport } from "better-content/core";

const transport = adapterTransport(dataAdapter);
```

Drives a `DataAdapter` directly: `save` calls `upsert`, `patch` calls
`update`, `remove` calls `delete`. Use it when the engine and the database
live in the same process:

- server-rendered apps writing without a loopback HTTP call,
- tests that want the full engine-to-database path,
- in-browser databases. The [live demo](https://better-content-playground.vercel.app)
  runs the real Postgres adapter against PGlite (Postgres compiled to
  WebAssembly) inside your tab with this transport.

Note what you give up: no HTTP layer means no server-side auth gate in the
path. That is fine in-process; it is not how you expose editing to browsers
against a shared database.

## inMemoryTransport (tests and demos)

```ts
import { inMemoryTransport } from "better-content/core";

const transport = inMemoryTransport({ posts: [{ id: "a", title: "Seed" }] });
```

A `Map` with the Transport interface, plus `get(collection, id)` and
`list(collection)` inspection helpers for assertions. The whole engine works
against it, which is how you unit-test editing flows with zero
infrastructure.

## Writing your own

Any persistence you can express in three async functions works: tRPC
mutations, Next.js server actions, GraphQL, a message queue. Throw on
failure; the engine takes care of rollback and user notification.

```ts
const trpcTransport: Transport = {
  save: (c, id, item) => client.cms.save.mutate({ c, id, item }),
  patch: (c, id, partial) => client.cms.patch.mutate({ c, id, partial }),
  remove: (c, id) => client.cms.remove.mutate({ c, id }),
};
```
