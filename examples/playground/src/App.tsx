import { useEffect, useState } from "react";
import {
  restTransport,
  type ClientStorageAdapter,
  type Item,
  type ItemMap,
} from "better-content/core";
import {
  AnonymousEditProvider,
  ContentEditSpan,
  EditableImage,
  PageProvider,
  useCmsAuth,
  usePageContext,
} from "better-content/react";

const transport = restTransport();

const dataUrlStorage: ClientStorageAdapter = {
  upload: (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ url: reader.result as string });
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    }),
};

const defaultItems: ItemMap = {
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
  const { getItem } = usePageContext();
  const cover = (getItem("sections", "hero")?.cover as string) ?? "";

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
      <EditableImage
        collection="sections"
        itemId="hero"
        fieldKey="cover"
        src={cover}
      >
        {({ src, isEditing, saving, openFilePicker, imgProps }) => (
          <figure
            onClick={isEditing && !saving ? openFilePicker : undefined}
            style={{
              margin: 0,
              cursor: isEditing ? "pointer" : "default",
            }}
          >
            {src ? (
              <img
                {...imgProps}
                alt="cover"
                style={{ maxWidth: "100%", borderRadius: "6px" }}
              />
            ) : (
              <div
                style={{
                  padding: "3rem 1rem",
                  textAlign: "center",
                  background: "#f2f2f2",
                  color: "#666",
                  borderRadius: "6px",
                }}
              >
                {isEditing ? "Click to upload a cover image" : "No cover image"}
              </div>
            )}
          </figure>
        )}
      </EditableImage>
    </main>
  );
}

export default function App() {
  const [initialItems, setInitialItems] = useState<ItemMap | null>(null);

  useEffect(() => {
    fetch("/api/admin/sections/hero")
      .then((res) => (res.ok ? (res.json() as Promise<Item>) : null))
      .then((item) =>
        setInitialItems(item ? { sections: [item] } : defaultItems),
      )
      .catch(() => setInitialItems(defaultItems));
  }, []);

  if (!initialItems) return null;

  return (
    <AnonymousEditProvider>
      <PageProvider
        transport={transport}
        storage={dataUrlStorage}
        initialItems={initialItems}
      >
        <Toolbar />
        <Hero />
      </PageProvider>
    </AnonymousEditProvider>
  );
}
