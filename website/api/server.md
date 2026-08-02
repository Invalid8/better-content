# better-content/server

Server-side building blocks over web-standard Request/Response. No framework
dependency; works in Next.js route handlers, Remix, Hono, Bun, or plain
Node 18+.

## createCmsHandlers

```ts
function createCmsHandlers(deps: CmsHandlersDeps): {
  GET: RouteHandler;
  PUT: RouteHandler;
  PATCH: RouteHandler;
  DELETE: RouteHandler;
  sign: (req: Request) => Promise<Response>;
};

interface CmsHandlersDeps {
  data: DataAdapter;
  auth: AuthAdapter;
  storage?: ServerStorageAdapter;   // enables the sign handler
  authorize?: AuthorizeFn;          // default: identity.isAdmin === true
  onError?: (error: unknown) => void;  // default: console.error
}

type RouteHandler = (
  req: Request,
  ctx: { params: Promise<{ collection: string; id: string }> },
) => Promise<Response>;
```

Route semantics at `{base}/{collection}/{id}`:

| Handler | Adapter call | Success | Errors |
|---|---|---|---|
| GET | `fetchById` | 200 document | 404 when missing |
| PUT | `upsert` (body) | `{ ok: true }` | 400 invalid body |
| PATCH | `update` (body) | `{ ok: true }` | 400 invalid body |
| DELETE | `delete` | `{ ok: true }` | |
| sign | `storage.sign` | signer payload | 404 without storage |

Every handler runs the admin gate first: **401** `{ error, logout: true }`
for unverified requests, **403** for verified non-admins. Bodies must be JSON
objects.

Anything else (adapter, storage, or driver failures) is passed to `onError`
and answered with a generic **500** `{ error: "Request failed" }`. The
underlying message never reaches the client, because adapter errors routinely
contain query text and parameter values. Pass your own `onError` to route
these to a real logger.

## createAdminGate

```ts
function createAdminGate(auth: AuthAdapter, authorize?: AuthorizeFn):
  (req: Request) => Promise<AuthIdentity>;

class UnauthorizedError extends Error {
  status: 401 | 403;
}
```

The same gate the handlers use, exported for guarding your own routes. It
throws `UnauthorizedError`; catch it and map `status` yourself.

## loadItemMap

```ts
function loadItemMap(data: DataAdapter, collections: ItemMapLoadConfig): Promise<ItemMap>;

type ItemMapLoadConfig = Record<string, {
  query?: Query;
  defaults?: Item[];              // used with merge: "byId"
  merge?: "replace" | "byId";     // default "replace"
  fallback?: Item[];              // used only when the fetch throws
}>;
```

Loads collections concurrently into the `ItemMap` shape `PageProvider`
hydrates from.

- `merge: "byId"` layers fetched rows over `defaults` by id: stored fields
  win, default-only fields survive, rows without defaults append.
- `fallback` applies only when the fetch **throws** (an empty result is a
  valid result). Without a fallback the error propagates.

## createContentHandler

```ts
function createContentHandler(deps: {
  data: DataAdapter;
  collections: ItemMapLoadConfig;   // same shape loadItemMap takes
  auth?: AuthAdapter;               // omit for a public endpoint
  authorize?: AuthorizeFn;
  cacheControl?: string;            // default "no-store"
  onError?: (error: unknown) => void;
}): { GET: (req?: Request) => Promise<Response> };
```

The public **read** half of the CMS: it returns the same `ItemMap` a
server-rendered page would build with `loadItemMap`, as JSON.

`createCmsHandlers` covers writes. Its `GET` is admin-gated and fetches a
single document by id, so it cannot answer "the content for this page". Any
app rendering on the client needs this route instead, paired with
[`fetchItemMap`](/api/core#fetchitemmap).

```ts
// Next.js: src/app/api/content/route.ts
import { createContentHandler } from "better-content/server";
import { data } from "@/lib/data";

export const { GET } = createContentHandler({
  data,
  collections: {
    sections: {
      defaults: [{ id: "hero", heading: "Edit this heading" }],
      merge: "byId",
    },
  },
});
```

It is public by default, because it only ever reads the content the page
already shows. Pass `auth` to gate it, for a site whose content is not public;
note that a browser visitor then cannot read it either, which is usually not
what you want.

Adapter failures answer `{ error: "Request failed" }` with a 500 and go to
`onError` (default `console.error`), the same as `createCmsHandlers`, so query
text and parameter values never reach the client.

## resolveRelations

```ts
function resolveRelations<T>(adapter: DataAdapter, docs: T | T[], options?: {
  populate?: string[];            // default: every field named in relations
  relations?: RelationConfig;     // maps bare-id fields → target collection
}): Promise<T | T[]>;
```

Inline-resolves reference fields on one or many documents. A reference is a
self-describing `{ collection, id }` object, a bare id string mapped through
`relations`, or an array of either (resolved element-wise). Loads are
deduplicated: each unique `(collection, id)` fetches once across the whole
batch. Unresolvable references (fetch returns null) are left untouched.
Mutates and returns the input.
