import {
  ContentEditSpan,
  EditableImage,
  usePageContext,
} from "better-content/react";

export function Hero({ databaseReady }: { databaseReady: boolean }) {
  const { getItem } = usePageContext();
  const cover = (getItem("sections", "hero")?.cover as string) ?? "";

  return (
    <section className="hero">
      <div>
        <p className="eyebrow">
          {databaseReady
            ? "Live demo: a real Postgres is running in this tab"
            : "Loading the local Postgres database"}
        </p>
        <ContentEditSpan
          as="h1"
          collection="sections"
          itemId="hero"
          fieldKey="heading"
        />
        <ContentEditSpan
          as="p"
          className="tagline"
          collection="sections"
          itemId="hero"
          fieldKey="tagline"
        />
      </div>
      <div className="cover">
        <EditableImage
          collection="sections"
          itemId="hero"
          fieldKey="cover"
          src={cover}
        >
          {({ src, isEditing, saving, openFilePicker, imgProps }) => (
            <figure
              style={{ margin: 0 }}
              onClick={isEditing && !saving ? openFilePicker : undefined}
            >
              {src ? (
                <img {...imgProps} alt="Editable cover" />
              ) : (
                <div className="placeholder">
                  {isEditing
                    ? "cover: click to upload an image"
                    : "cover: an empty text column in the sections table"}
                </div>
              )}
            </figure>
          )}
        </EditableImage>
      </div>
    </section>
  );
}
