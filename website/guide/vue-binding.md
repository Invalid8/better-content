# Vue binding

`better-content/vue` binds the engine to Vue 3 with two composables and a
directive. Vue is an optional peer dependency; the binding imports only
`shallowRef` and `onScopeDispose`.

## Setup

Create one engine and share it however your app prefers (module scope,
provide/inject, a prop):

```ts
// lib/cms.ts
import { createCmsEngine, restTransport } from "better-content/core";

export const engine = createCmsEngine({
  transport: restTransport(),
  initialItems,
});
```

## Composables

```vue
<script setup lang="ts">
import { useCmsSnapshot, useCmsItem } from "better-content/vue";
import { engine } from "@/lib/cms";

const snapshot = useCmsSnapshot(engine);           // whole-engine ref
const hero = useCmsItem(engine, "sections", "hero"); // one item, fine-grained
</script>

<template>
  <button
    :disabled="!snapshot.hasUnsavedChanges || snapshot.saving"
    @click="engine.saveAll()"
  >
    {{ snapshot.saving ? "Saving" : "Save all" }}
  </button>
  <p>{{ hero?.tagline }}</p>
</template>
```

Both return shallow refs and clean up their subscriptions when the component
scope disposes. `useCmsItem` only triggers when its item's reference
changes, the same identity-based granularity as React's `useCmsItem` and
Svelte's `itemStore`.

## Inline editing with the directive

```vue
<script setup lang="ts">
import { shallowRef } from "vue";
import { vContentEdit } from "better-content/vue";
import { engine } from "@/lib/cms";

const editing = shallowRef(false);
</script>

<template>
  <button @click="editing = !editing">{{ editing ? "Done" : "Edit" }}</button>

  <h1 v-content-edit="{ engine, collection: 'sections', itemId: 'hero', fieldKey: 'heading', editing }"></h1>
  <p v-content-edit="{ engine, collection: 'sections', itemId: 'hero', fieldKey: 'tagline', editing }"></p>
</template>
```

In `<script setup>`, importing `vContentEdit` makes `v-content-edit`
available automatically (Vue's directive naming convention). The directive
renders the field's value into the element, keeps it in sync with engine
changes, and makes it `contenteditable` while `editing` is true. Drafts stay
DOM-owned while focused; blur commits through `editField` (deferred).
Multi-line input is preserved as `\n` and rendered with
`white-space: pre-wrap`.

Leave the element childless: the directive owns its text content.

Styling hooks are the shared attributes:

```css
[data-cms-editing] { outline: 1px dashed #999; }
[data-cms-focused] { outline: 2px solid #4a90d9; }
```

## Nuxt and SSR

Load content on the server with `loadItemMap` from `better-content/server`
and pass it into `createCmsEngine` as `initialItems`. Mount the API with
`createCmsHandlers` in a server route; the handlers speak web-standard
Request/Response, which Nitro (Nuxt's server) supports natively.

## Image editing

`useEditableImage` returns reactive state plus methods, with the same
semantics as React's `EditableImage`: picking a file previews it
immediately via an object URL and queues a pending upload that the engine
flushes on save; external URLs are validated as http(s) and queued without
a file.

```vue
<script setup lang="ts">
import { useEditableImage } from "better-content/vue";
import { engine } from "@/lib/cms";

const { src, openFilePicker, handleError } = useEditableImage(engine, {
  collection: "sections",
  itemId: "hero",
  fieldKey: "cover",
});
</script>

<template>
  <figure @click="openFilePicker">
    <img v-if="src" :src="src" alt="Cover" @error="handleError" />
    <span v-else>no cover yet</span>
  </figure>
</template>
```

Give the engine a `storage` adapter (see [Image storage](/guide/storage)),
or file uploads have nowhere to go when the save flushes.

## What is intentionally not here

Markdown editing ships as a React hook today; on Vue, drive the engine
directly or write your own directive using `vContentEdit`'s source as the
pattern.
