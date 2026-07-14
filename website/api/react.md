# better-content/react

The React binding. Ships with `"use client"` directives; React 18 or newer.

## PageProvider

```tsx
interface PageProviderProps extends CmsEngineOptions {
  children: ReactNode;
}

<PageProvider transport={...} storage={...} notify={...} initialItems={...}>
```

Creates one engine for its lifetime and provides both contexts. All
`CmsEngineOptions` are captured at mount; changing props later does not
recreate the engine (remount with a `key` if you need to).

## Hooks

```ts
function usePageContext(): PageContextValue;
// snapshot fields + every engine op + the engine itself; coarse, re-renders on any change

function useCmsEngine(): CmsEngine;
// the stable engine; never re-renders by itself

function useCmsItem(collection: string, id: string): Item | undefined;
// fine-grained: re-renders only when this item's reference changes
```

All three throw outside a `PageProvider`.

## ContentEditSpan

```tsx
interface ContentEditSpanProps {
  collection: string;
  itemId: string;
  fieldKey: string;              // dotted paths supported
  as?: ElementType;              // default "span"
  className?: string;
  children?: ReactNode;          // string children act as fallback text
  renderValue?: (raw: string) => ReactNode;  // default: plain text
}
```

Headless inline text editor. Reads edit mode from `useCmsAuth`. Commits
drafts on blur via `editField`. Preserves multi-line input as `\n` and
renders with `white-space: pre-wrap`. Styling hooks: `data-cms-editable`,
`data-cms-editing`, `data-cms-focused`.

## EditableImage

```tsx
interface EditableImageProps {
  collection: string;
  itemId: string;
  fieldKey: string;
  src: string;
  className?: string;
  children?: (state: EditableImageRenderState) => ReactNode;
}

interface EditableImageRenderState {
  src: string;                       // preview, external URL, or saved src
  isEditing: boolean;
  saving: boolean;
  hasError: boolean;                 // current src failed to load
  openFilePicker: () => void;
  setExternalUrl: (url: string) => boolean;  // false if not a valid http(s) URL
  imgProps: { src: string; onError: () => void };
}
```

Render-prop image editor over the pending-image queue. Renders a bare
`<img>` without children.

## useMarkdownEditor

```ts
function useMarkdownEditor(options: {
  initialValue: string;
  onSave: (content: string) => void | Promise<void>;
}): MarkdownEditorApi;

interface MarkdownEditorApi {
  value: string;
  setValue(next: string): void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  insert(before: string, after?: string, placeholder?: string): void;
  reset(to?: string): void;
  save(): void | Promise<void>;
  charCount: number;
}
```

## Auth context

```tsx
function useCmsAuth(): CmsAuthState;   // throws outside a provider

<CmsAuthProvider value={cmsAuthState}>      // bring your own auth
<AnonymousEditProvider>                     // local edit toggle, isAdmin stays false
```

`CmsAuthContext` is exported for advanced composition; built-in auth
providers feed the same context instance through the public specifier.
