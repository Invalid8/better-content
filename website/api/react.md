# better-content/react

The React binding. Ships with `"use client"` directives; React 18 or newer.

## PageProvider

```tsx
type PageProviderProps = { children: ReactNode } & (
  | ({ engine: CmsEngine } & Partial<CmsEngineOptions>)  // bind an external engine
  | ({ engine?: undefined } & CmsEngineOptions)          // or create one from options
);

<PageProvider transport={...} storage={...} notify={...} initialItems={...}>
<PageProvider engine={sharedEngine}>
```

Creates one engine for its lifetime and provides both contexts, or binds an
engine you created with `createCmsEngine` — the way to share one engine
across multiple React roots or across frameworks (e.g. Astro islands). All
props are captured at mount; changing them later does not recreate or swap
the engine (remount with a `key` if you need to).

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
