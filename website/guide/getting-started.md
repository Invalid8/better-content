# Getting started

better-content is an inline-edit CMS engine: your visitors (or just you, as
the admin) edit content directly on the live page, and every field persists
to your own database through a small adapter.

## Install

```sh
npm install better-content
```

Everything heavy is an **optional peer dependency**. Install only what your
stack uses:

```sh
# React binding
npm install react

# Postgres adapter
npm install drizzle-orm pg

# Firebase auth
npm install firebase firebase-admin

# Cloudinary storage
npm install cloudinary
```

## 1. Make a page editable

Wrap the page in `PageProvider` and drop editable primitives where content
goes:

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
        <ContentEditSpan
          as="h1"
          collection="sections"
          itemId="hero"
          fieldKey="heading"
        />
        <ContentEditSpan
          as="p"
          collection="sections"
          itemId="hero"
          fieldKey="tagline"
        />
      </PageProvider>
    </AnonymousEditProvider>
  );
}
```

`AnonymousEditProvider` gives the page a local edit-mode toggle without any
auth wiring; swap it for a real auth provider later. `ContentEditSpan` is
headless: it renders your tag with `contentEditable` behavior and exposes
state through `data-cms-*` attributes you style yourself:

```css
[data-cms-editing] {
  outline: 1px dashed #999;
}
[data-cms-focused] {
  outline: 2px solid #4a90d9;
}
```

## 2. Add a save button

```tsx
import { useCmsAuth, usePageContext } from "better-content/react";

function Toolbar() {
  const { isEditing, toggleEdit } = useCmsAuth();
  const { hasUnsavedChanges, saving, saveAll } = usePageContext();

  return (
    <>
      <button onClick={toggleEdit}>{isEditing ? "Done" : "Edit"}</button>
      <button onClick={() => saveAll()} disabled={!hasUnsavedChanges || saving}>
        {saving ? "Saving" : "Save all"}
      </button>
    </>
  );
}
```

Edits buffer locally until save. See
[the editing model](/guide/editing-model) for the full lifecycle.

## 3. Mount the API

`createCmsHandlers` produces standard Request/Response handlers. In a
Next.js App Router project:

```ts
// app/api/admin/[collection]/[id]/route.ts
import { createCmsHandlers } from "better-content/server";
import { PostgresDataAdapter } from "better-content/adapters/postgres";
import { firebaseAuth } from "better-content/auth/firebase";
import { schema } from "@/db/schema";

export const { GET, PATCH, PUT, DELETE } = createCmsHandlers({
  data: new PostgresDataAdapter({
    connectionString: process.env.DATABASE_URL,
    schema,
  }),
  auth: firebaseAuth({ adminEmails: ["you@example.com"] }),
});
```

Any runtime with web-standard `Request`/`Response` works the same way. The
handlers gate every write through your `AuthAdapter`; see
[auth](/guide/auth).

## 4. Load initial content on the server

```ts
import { loadItemMap } from "better-content/server";

const initialItems = await loadItemMap(data, {
  sections: {
    defaults: [{ id: "hero", heading: "Hello", tagline: "Edit me" }],
    merge: "byId",
  },
  posts: {
    query: { orderBy: [{ field: "order", direction: "asc" }] },
  },
});
```

`merge: "byId"` layers stored rows over your in-code defaults, so a fresh
database still renders a complete page and edits win once they exist.

## Where to go next

- [How the engine works](/guide/how-it-works): the architecture underneath.
- [Transports](/guide/transports): skip HTTP entirely, or bring your own.
- [Database adapters](/guide/adapters): Postgres, Firestore, or yours.
- [Devtools](/guide/devtools): watch your data change while you build.
