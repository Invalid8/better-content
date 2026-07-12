import { inMemoryTransport } from "better-content/core";
import {
  AnonymousEditProvider,
  ContentEditSpan,
  PageProvider,
  useCmsAuth,
  usePageContext,
} from "better-content/react";

const transport = inMemoryTransport();

const initialItems = {
  sections: [
    {
      id: "hero",
      heading: "Edit me inline",
      tagline: "Toggle edit mode, click any text, type, then save.",
    },
  ],
};

function Toolbar() {
  const { isEditing, toggleEdit } = useCmsAuth();
  const { hasUnsavedChanges, saving, saveAll } = usePageContext();

  return (
    <header>
      <button onClick={toggleEdit}>{isEditing ? "Done" : "Edit"}</button>
      <button
        onClick={() => void saveAll()}
        disabled={!hasUnsavedChanges || saving}
      >
        {saving ? "Saving…" : hasUnsavedChanges ? "Save all" : "Saved"}
      </button>
    </header>
  );
}

function Hero() {
  return (
    <main>
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
    </main>
  );
}

export default function App() {
  return (
    <AnonymousEditProvider>
      <PageProvider transport={transport} initialItems={initialItems}>
        <Toolbar />
        <Hero />
      </PageProvider>
    </AnonymousEditProvider>
  );
}
