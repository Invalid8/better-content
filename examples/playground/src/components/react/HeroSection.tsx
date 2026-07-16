import { useEffect, useState } from "react";
import type { CmsEngine } from "better-content/core";
import {
  CmsAuthProvider,
  ContentEditSpan,
  EditableImage,
  PageProvider,
  usePageContext,
} from "better-content/react";
import { ready } from "../../lib/engine";
import { editMode } from "../../lib/editMode";

function Hero() {
  const { getItem } = usePageContext();
  const cover = (getItem("page", "hero")?.cover as string) ?? "";

  return (
    <div className="hero-live">
      <div className="hero-copy">
        <ContentEditSpan
          as="h1"
          className="hero-headline"
          collection="page"
          itemId="hero"
          fieldKey="headline"
        />
        <ContentEditSpan
          as="p"
          className="hero-intro"
          collection="page"
          itemId="hero"
          fieldKey="intro"
        />
      </div>
      <EditableImage collection="page" itemId="hero" fieldKey="cover" src={cover}>
        {({ src, isEditing, saving, openFilePicker, imgProps }) => (
          <figure
            className="hero-cover"
            data-editing={isEditing || undefined}
            onClick={isEditing && !saving ? openFilePicker : undefined}
          >
            {src ? (
              <img {...imgProps} alt="Editable cover, a text column holding an image URL" />
            ) : (
              <div className="cover-empty">
                cover: an empty text column in the page table
              </div>
            )}
            {isEditing && <figcaption>click to replace, stored on Save</figcaption>}
          </figure>
        )}
      </EditableImage>
    </div>
  );
}

export default function HeroSection() {
  const [engine, setEngine] = useState<CmsEngine | null>(null);
  const [isEditing, setIsEditing] = useState(editMode.get());

  useEffect(() => {
    void ready.then(setEngine);
    return editMode.subscribe(() => setIsEditing(editMode.get()));
  }, []);

  if (!engine) {
    return <p className="island-loading">starting the content engine…</p>;
  }

  return (
    <CmsAuthProvider
      value={{ isAdmin: false, isEditing, toggleEdit: editMode.toggle }}
    >
      <PageProvider engine={engine}>
        <Hero />
      </PageProvider>
    </CmsAuthProvider>
  );
}
