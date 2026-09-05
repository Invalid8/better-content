# better-content/vue

The Vue 3 binding: composables and a directive. Vue is an optional peer
dependency; the binding imports only `shallowRef` and `onScopeDispose`.

## Composables

```ts
function useCmsSnapshot(engine: CmsEngine): Readonly<ShallowRef<CmsSnapshot>>;
// whole-engine ref; updates on every engine change

function useCmsItem(
  engine: CmsEngine,
  collection: string,
  id: string,
): Readonly<ShallowRef<Item | undefined>>;
// fine-grained: updates only when this item's reference changes
```

Both subscribe when called and clean up when the calling component's scope
disposes, so call them during `setup`.

## vContentEdit

```ts
interface ContentEditBinding {
  engine: CmsEngine;
  collection: string;
  itemId: string;
  fieldKey: string;
  editing: boolean;
}
```

```vue
<h1 v-content-edit="{ engine, collection: 'sections', itemId: 'hero', fieldKey: 'heading', editing }"></h1>
```

Inline text editor as a directive. In `<script setup>`, importing
`vContentEdit` makes `v-content-edit` available automatically. Renders the
field value into the element, keeps it in sync with engine changes, and
makes it `contenteditable` while `editing` is true. Drafts stay DOM-owned
while focused; blur commits through `editField` (deferred). Multi-line
input is preserved as `\n` and rendered with `white-space: pre-wrap`.
Styling hooks: `data-cms-editable`, `data-cms-editing`,
`data-cms-focused`. Leave the element childless: the directive owns its
text content.

## useEditableImage

```ts
interface EditableImageOptions {
  collection: string;
  itemId: string;
  fieldKey: string;
  accept?: string;               // file-picker filter, default "image/*"
}

interface EditableImageApi {
  src: Readonly<ShallowRef<string>>;       // pending preview or the stored value
  saving: Readonly<ShallowRef<boolean>>;
  hasError: Readonly<ShallowRef<boolean>>; // set via handleError, cleared on selection
  openFilePicker(): void;                  // no-op while saving or during SSR
  selectFile(file: File): void;
  setExternalUrl(url: string): boolean;    // false if not a valid http(s) URL
  handleError(): void;                     // wire to the img error event
}

function useEditableImage(engine: CmsEngine, options: EditableImageOptions): EditableImageApi;
```

```vue
<script setup lang="ts">
const { src, openFilePicker, handleError } = useEditableImage(engine, {
  collection: "sections",
  itemId: "hero",
  fieldKey: "cover",
});
</script>

<template>
  <figure @click="openFilePicker">
    <img v-if="src" :src="src" alt="Cover" @error="handleError" />
  </figure>
</template>
```

Image editor with the same semantics as React's `EditableImage`: picking a
file previews it via an object URL and queues a pending upload that the
engine flushes on save; `setExternalUrl` validates http(s) URLs and queues
them without a file. The engine needs a `storage` adapter for file uploads
to persist.

## useMarkdownEditor

```ts
interface MarkdownEditorOptions {
  initialValue: string;
  onSave: (content: string) => void | Promise<void>;
}

interface MarkdownEditorApi {
  value: Readonly<ShallowRef<string>>;
  charCount: Readonly<ShallowRef<number>>;
  textareaRef: ShallowRef<HTMLTextAreaElement | null>;
  setValue(next: string): void;
  insert(before: string, after?: string, placeholder?: string): void;
  reset(to?: string): void;                // defaults to the initial value
  save(): void | Promise<void>;            // passes the current value to onSave
}

function useMarkdownEditor(options: MarkdownEditorOptions): MarkdownEditorApi;
```

```vue
<script setup lang="ts">
const md = useMarkdownEditor({
  initialValue: item.body,
  onSave: (content) => engine.editField("posts", item.id, "body", content),
});
const { textareaRef } = md;
</script>

<template>
  <button @click="md.insert('**', '**', 'bold')">bold</button>
  <textarea
    ref="textareaRef"
    :value="md.value.value"
    @input="md.setValue(($event.target as HTMLTextAreaElement).value)"
  ></textarea>
  <button @click="md.save()">Save</button>
</template>
```

Headless markdown editing with the same semantics as React's
`useMarkdownEditor`. `insert` wraps the textarea's current selection, or
inserts `placeholder` when the selection is empty, and leaves the caret at the
end of the wrapped text so typing continues inside the wrap. Bind
`textareaRef` to reach the selection; without it `insert` appends at the end
of the value.

It takes no `CmsEngine`: the draft is local until `save` hands it to your
callback, so wiring it to `editField` is your line of code.
