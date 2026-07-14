# Devtools

## better-content/devtools

```ts
function registerDataInspector(tagName?: string): void;
// defines the element; idempotent; no-op during SSR

const DATA_INSPECTOR_TAG = "better-content-inspector";

interface DataInspectorElement extends HTMLElement {
  adapter: DataAdapter | null;     // property; only fetchCollection is called
  engine: CmsEngine | null;        // property; subscribes for auto-refresh on saves
  collections: string[];           // property, or attribute "a,b,c"
  refresh(): Promise<void>;
}
```

A framework-free custom element rendering a floating button and a dialog of
live collection tables. Styles live in shadow DOM; the element carries zero
runtime dependencies. Setting `engine` subscribes to it (refreshing after
each completed save) and unsubscribes when the element disconnects or the
property is cleared.

```html
<better-content-inspector collections="sections,posts"></better-content-inspector>
```

## better-content/devtools/react

```tsx
function DataInspector(props: {
  adapter: DataAdapter;
  collections: string[];
  engine?: CmsEngine;
}): JSX.Element;
```

Typed wrapper over the element: registers it, renders it, and assigns the
object properties through a ref, so it works on React 18 and 19 without JSX
augmentation.

Mount either flavor behind a development flag only; the inspector reads
through the adapter with no gate of its own.
