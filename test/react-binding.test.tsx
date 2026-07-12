import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { inMemoryTransport } from "../src/core/transport";
import {
  AnonymousEditProvider,
  ContentEditSpan,
  PageProvider,
  usePageContext,
} from "../src/react/index";

const seeded = {
  sections: [{ id: "hero", heading: "Hello world", cta: { label: "Go" } }],
};

const page = (children: React.ReactNode) => (
  <AnonymousEditProvider>
    <PageProvider transport={inMemoryTransport()} initialItems={seeded}>
      {children}
    </PageProvider>
  </AnonymousEditProvider>
);

describe("PageProvider binding", () => {
  it("renders a field from the engine snapshot", () => {
    const html = renderToString(
      page(
        <ContentEditSpan
          as="h1"
          collection="sections"
          itemId="hero"
          fieldKey="heading"
        />,
      ),
    );
    expect(html).toContain("<h1");
    expect(html).toContain("Hello world");
  });

  it("resolves dotted field keys", () => {
    const html = renderToString(
      page(
        <ContentEditSpan
          collection="sections"
          itemId="hero"
          fieldKey="cta.label"
        />,
      ),
    );
    expect(html).toContain("Go");
  });

  it("falls back to string children when the field is missing", () => {
    const html = renderToString(
      page(
        <ContentEditSpan collection="sections" itemId="hero" fieldKey="missing">
          fallback
        </ContentEditSpan>,
      ),
    );
    expect(html).toContain("fallback");
  });

  it("exposes engine state through usePageContext", () => {
    const Probe = () => {
      const { hasUnsavedChanges, saving, getItem } = usePageContext();
      const heading = getItem("sections", "hero")?.heading;
      return <output>{[hasUnsavedChanges, saving, heading].join(":")}</output>;
    };
    const html = renderToString(page(<Probe />));
    expect(html).toContain("false:false:Hello world");
  });

  it("throws when usePageContext is used outside the provider", () => {
    const Naked = () => {
      usePageContext();
      return null;
    };
    expect(() => renderToString(<Naked />)).toThrow(
      "usePageContext must be used within a PageProvider",
    );
  });
});
