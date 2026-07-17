# Svelte binding

`better-content/svelte` binds the engine to Svelte with the platform's own
primitives: the store contract and element actions. It has no dependency on
the svelte package and works with Svelte 4 and 5 (stores and actions are
supported in both).

## Setup

Create one engine for the page and share it however you prefer (module
scope, context, a prop):

```ts
// lib/cms.ts
import { createCmsEngine, restTransport } from "better-content/core";

export const engine = createCmsEngine({
  transport: restTransport(),
  initialItems,   // from your load function
});
```

## Stores

```svelte
<script lang="ts">
  import { engineStore, itemStore } from "better-content/svelte";
  import { engine } from "$lib/cms";

  const snapshot = engineStore(engine);        // whole-engine store
  const hero = itemStore(engine, "sections", "hero");  // one item, fine-grained
</script>

<button
  on:click={() => engine.saveAll()}
  disabled={!$snapshot.hasUnsavedChanges || $snapshot.saving}
>
  {$snapshot.saving ? "Saving" : "Save all"}
</button>

<p>{$hero?.tagline}</p>
```

Both implement Svelte's readable-store contract, so `$` auto-subscription
just works. `itemStore` only emits when its item's reference changes, the
same identity-based granularity as React's `useCmsItem`: editing one item
does not wake subscribers of another.

## Inline editing with the action

```svelte
<script lang="ts">
  import { contentEdit } from "better-content/svelte";
  import { engine } from "$lib/cms";

  let editing = false;
</script>

<button on:click={() => (editing = !editing)}>
  {editing ? "Done" : "Edit"}
</button>

<h1 use:contentEdit={{ engine, collection: "sections", itemId: "hero", fieldKey: "heading", editing }} />
<p use:contentEdit={{ engine, collection: "sections", itemId: "hero", fieldKey: "tagline", editing }} />
```

The action renders the field's current value into the element, keeps it in
sync with engine changes, and when `editing` is true makes it
`contenteditable`. Drafts stay DOM-owned while focused; blur commits through
`editField` (deferred, so the save button decides when it persists).
Multi-line input is preserved as `\n` and rendered with
`white-space: pre-wrap`.

Styling hooks are the same attributes the React primitive uses:

```css
[data-cms-editing] { outline: 1px dashed #999; }
[data-cms-focused] { outline: 2px solid #4a90d9; }
```

Because the params object includes `editing`, Svelte re-runs the action's
`update` whenever your edit-mode state changes; no wrapper components
needed.

## SvelteKit

Load content on the server with the same server module React apps use:

```ts
// +page.server.ts
import { loadItemMap } from "better-content/server";

export async function load() {
  return { initialItems: await loadItemMap(data, { sections: {} }) };
}
```

Mount the API with `createCmsHandlers` in a
`src/routes/api/admin/[collection]/[id]/+server.ts` endpoint; the handlers
take web-standard Request/Response, which is exactly what SvelteKit
endpoints speak.

## Image editing

`imageEdit` returns a readable store plus methods, with the same semantics
as React's `EditableImage`: picking a file previews it immediately via an
object URL and queues a pending upload that the engine flushes on save;
external URLs are validated as http(s) and queued without a file.

```svelte
<script lang="ts">
  import { imageEdit } from "better-content/svelte";
  import { engine } from "$lib/cms";

  export let editing: boolean;

  const cover = imageEdit(engine, {
    collection: "sections",
    itemId: "hero",
    fieldKey: "cover",
  });
</script>

<figure on:click={() => editing && cover.openFilePicker()}>
  {#if $cover.src}
    <img src={$cover.src} alt="Cover" on:error={cover.handleError} />
  {:else}
    <span>no cover yet</span>
  {/if}
</figure>
```

Give the engine a `storage` adapter (see [Image storage](/guide/storage)),
or file uploads have nowhere to go when the save flushes.

## What is intentionally not here

Markdown editing ships as a React hook today; on Svelte, drive the engine
directly or wrap your own action following `contentEdit` as the pattern. If
you build one, an issue or PR is welcome.
