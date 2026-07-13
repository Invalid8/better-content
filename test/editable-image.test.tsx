import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { inMemoryTransport } from "../src/core/transport";
import {
  AnonymousEditProvider,
  EditableImage,
  PageProvider,
} from "../src/react/index";

const page = (children: React.ReactNode) => (
  <AnonymousEditProvider>
    <PageProvider transport={inMemoryTransport()}>{children}</PageProvider>
  </AnonymousEditProvider>
);

describe("EditableImage", () => {
  it("renders a bare img with the src when no render-prop is given", () => {
    const html = renderToString(
      page(
        <EditableImage
          collection="sections"
          itemId="hero"
          fieldKey="cover"
          src="https://a.test/pic.png"
        />,
      ),
    );
    expect(html).toContain('src="https://a.test/pic.png"');
    expect(html).toContain('type="file"');
  });

  it("hands state to the render-prop", () => {
    const html = renderToString(
      page(
        <EditableImage
          collection="sections"
          itemId="hero"
          fieldKey="cover"
          src="https://a.test/pic.png"
        >
          {({ src, isEditing, saving, hasError }) => (
            <output>{[src, isEditing, saving, hasError].join("|")}</output>
          )}
        </EditableImage>,
      ),
    );
    expect(html).toContain("https://a.test/pic.png|false|false|false");
  });
});
