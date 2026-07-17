# better-content/svelte

The Svelte binding. Implements Svelte's readable-store contract and the
element-action contract directly, so it has **zero dependency on the svelte
package** and works with Svelte 4 and 5.

## Stores

```ts
function engineStore(engine: CmsEngine): Readable<CmsSnapshot>;
// whole-engine store; emits on every engine change

function itemStore(
  engine: CmsEngine,
  collection: string,
  id: string,
): Readable<Item | undefined>;
// fine-grained: emits only when this item's reference changes
```

Both satisfy the store contract (`subscribe(run)` returning an
unsubscriber), so `$` auto-subscription works. Subscribers are called
immediately with the current value.

## contentEdit action

```ts
interface ContentEditParams {
  engine: CmsEngine;
  collection: string;
  itemId: string;
  fieldKey: string;
  editing: boolean;
}

function contentEdit(node: HTMLElement, params: ContentEditParams): ContentEditAction;
```

```svelte
<h1 use:contentEdit={{ engine, collection: "sections", itemId: "hero", fieldKey: "heading", editing }} />
```

Inline text editor as an element action. Renders the field value into the
node, keeps it in sync with engine changes, and makes it `contenteditable`
while `editing` is true. Drafts stay DOM-owned while focused; blur commits
through `editField` (deferred). Multi-line input is preserved as `\n` and
rendered with `white-space: pre-wrap`. Styling hooks: `data-cms-editable`,
`data-cms-editing`, `data-cms-focused`. Leave the element childless: the
action owns its text content.

## imageEdit

```ts
interface ImageEditOptions {
  collection: string;
  itemId: string;
  fieldKey: string;
  accept?: string;               // file-picker filter, default "image/*"
}

interface ImageEditState {
  src: string;                   // pending preview or the stored value
  saving: boolean;
  hasError: boolean;             // set via handleError, cleared on selection
}

interface ImageEditStore extends Readable<ImageEditState> {
  openFilePicker(): void;                  // no-op while saving or during SSR
  selectFile(file: File): void;
  setExternalUrl(url: string): boolean;    // false if not a valid http(s) URL
  handleError(): void;                     // wire to the img error event
}

function imageEdit(engine: CmsEngine, options: ImageEditOptions): ImageEditStore;
```

```svelte
<script lang="ts">
  const cover = imageEdit(engine, { collection: "sections", itemId: "hero", fieldKey: "cover" });
</script>

<figure on:click={() => editing && cover.openFilePicker()}>
  {#if $cover.src}
    <img src={$cover.src} alt="Cover" on:error={cover.handleError} />
  {/if}
</figure>
```

Image editor with the same semantics as React's `EditableImage`: picking a
file previews it via an object URL and queues a pending upload that the
engine flushes on save; `setExternalUrl` validates http(s) URLs and queues
them without a file. The engine needs a `storage` adapter for file uploads
to persist.
