import {
  CmsAuthProvider,
  ContentEditSpan,
  PageProvider,
} from "better-content/react";
import { editMode } from "../../lib/editMode";
import { useLiveEngine } from "./useLiveEngine";

function HeroContent() {
  return (
    <>
      <h1 className="hero-title">
        <ContentEditSpan
          as="span"
          className="hero-line"
          collection="page"
          itemId="hero"
          fieldKey="headline"
        />
        <ContentEditSpan
          as="span"
          className="hero-line"
          collection="page"
          itemId="hero"
          fieldKey="tagline"
        />
      </h1>
      <ContentEditSpan
        as="p"
        className="hero-deck"
        collection="page"
        itemId="hero"
        fieldKey="intro"
      />
    </>
  );
}

export default function HeroIsland() {
  const { engine, isEditing } = useLiveEngine();

  if (!engine) {
    return (
      <div className="hero-skeleton" aria-hidden="true">
        <span className="hero-skeleton__title" />
        <span className="hero-skeleton__title" />
        <span className="hero-skeleton__deck" />
        <span className="hero-skeleton__deck" />
        <span className="hero-skeleton__deck" />
      </div>
    );
  }

  return (
    <CmsAuthProvider
      value={{ isAdmin: false, isEditing, toggleEdit: editMode.toggle }}
    >
      <PageProvider engine={engine}>
        <HeroContent />
      </PageProvider>
    </CmsAuthProvider>
  );
}
