# React binding

`better-content/react` is a thin layer over the engine. Everything stateful
lives in core; the binding adapts it to React's rendering model and ships
the headless editing primitives.

## PageProvider

```tsx
<PageProvider
  transport={restTransport()}
  storage={cloudinaryStorage()}   // optional, for image uploads
  notify={{ success: toast.success, error: toast.error }} // optional
  initialItems={initialItems}     // optional, server-loaded content
>
  {children}
</PageProvider>
```

The provider creates one engine for its lifetime, binds it with
`useSyncExternalStore`, and provides two contexts:

- a **snapshot context** whose value changes on every engine change, and
- an **engine context** whose value never changes (the engine object is
  stable).

That split is what lets coarse and fine-grained consumers coexist under one
provider.

## usePageContext: the coarse hook

```tsx
const {
  items, hasUnsavedChanges, saving, pendingImages,   // snapshot
  getItem, editField, setPendingImage,               // engine ops
  saveItem, saveAll,
  createItem, updateItem, deleteItem, reorderItems,
  engine,
} = usePageContext();
```

Any engine change re-renders every `usePageContext` consumer. Use it where
that is what you want: toolbars, save indicators, list sections that show a
whole collection. It throws when used outside a `PageProvider`.

## useCmsItem and useCmsEngine: the fine-grained hooks

```tsx
import { useCmsEngine, useCmsItem } from "better-content/react";

function PriceTag({ id }: { id: string }) {
  const item = useCmsItem("products", id);  // re-renders only when this item changes
  const { updateItem } = useCmsEngine();    // never causes re-renders by itself
  ...
}
```

`useCmsItem(collection, id)` subscribes to the engine with a per-item
selector. The engine's immutable updates preserve object identity for
untouched items, so React skips re-rendering subscribers of everything you
did not edit. On a page with many editable regions this is the difference
between one component re-rendering and all of them.

`useCmsEngine()` returns the stable engine for calling operations without
subscribing to anything.

## ContentEditSpan

```tsx
<ContentEditSpan
  as="h1"                      // any tag or component, default span
  collection="sections"
  itemId="hero"
  fieldKey="heading"           // dotted paths supported
  className="hero-title"
  renderValue={(raw) => md(raw)} // optional, default plain text
>
  Fallback text when the field is empty
</ContentEditSpan>
```

Headless by design: no look, no toolbar, no icons. It wires
`contentEditable`, buffers the draft while focused (the DOM owns the text,
so the caret never jumps), commits via `editField` on blur, and exposes
state as attributes for your CSS:

- `data-cms-editable` present when edit mode is on,
- `data-cms-editing` while editable,
- `data-cms-focused` while focused.

Multi-line input is preserved as `\n` in your data and rendered with
`white-space: pre-wrap`. Supply `renderValue` to render the stored string as
rich content (markdown, for example) when not editing.

It reads edit mode from `useCmsAuth`, so it must sit under an auth provider
(`AnonymousEditProvider` is enough for local edit toggling).

## EditableImage

```tsx
<EditableImage collection="sections" itemId="hero" fieldKey="cover" src={cover}>
  {({ src, isEditing, saving, hasError, openFilePicker, setExternalUrl, imgProps }) => (
    <figure onClick={isEditing ? openFilePicker : undefined}>
      {src ? <img {...imgProps} alt="" /> : <div>No image yet</div>}
    </figure>
  )}
</EditableImage>
```

A render-prop primitive: it manages a hidden file input, local preview,
external URL validation (http/https only), and the pending-image queue. You
render every pixel. Without children it falls back to a bare `<img>`.

## useMarkdownEditor

Headless markdown editing state for building your own editor UI:

```tsx
const md = useMarkdownEditor({ initialValue, onSave });

<textarea ref={md.textareaRef} value={md.value}
  onChange={(e) => md.setValue(e.target.value)} />
<button onClick={() => md.insert("**", "**", "bold")}>B</button>
<button onClick={md.save}>Save</button>
```

`insert(before, after?, placeholder?)` wraps the current textarea selection
and restores focus and caret. `reset`, `save`, and `charCount` round it out.
No modal, no toolbar, no preview renderer shipped.

## Auth context

The primitives read a minimal auth state through `useCmsAuth`:

```ts
interface CmsAuthState {
  isAdmin: boolean;
  isEditing: boolean;
  toggleEdit: () => void;
}
```

Provide it with `CmsAuthProvider` (bring your own auth),
`AnonymousEditProvider` (local-only edit toggle, `isAdmin` stays false), or
`FirebaseAuthProvider` from `better-content/auth/firebase/client`. See
[auth](/guide/auth).

## Server rendering

Everything renders under SSR. `PageProvider` passes a server snapshot to
`useSyncExternalStore`, and the built files carry `"use client"` directives
so Next.js App Router treats the binding as client components while your
server components pass `initialItems` down.
