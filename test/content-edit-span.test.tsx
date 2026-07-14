// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inMemoryTransport } from "../src/core/transport";
import {
  CmsAuthProvider,
  ContentEditSpan,
  PageProvider,
} from "../src/react/index";

const seeded = {
  sections: [{ id: "hero", heading: "Hello world" }],
};

describe("ContentEditSpan", () => {
  afterEach(() => {
    cleanup();
  });

  const renderEditableHeading = () =>
    render(
      <CmsAuthProvider
        value={{
          isAdmin: false,
          isEditing: true,
          toggleEdit: vi.fn(),
        }}
      >
        <PageProvider transport={inMemoryTransport()} initialItems={seeded}>
          <ContentEditSpan
            as="h1"
            collection="sections"
            itemId="hero"
            fieldKey="heading"
          />
        </PageProvider>
      </CmsAuthProvider>,
    );

  it("keeps existing text visible when focused for editing", async () => {
    renderEditableHeading();

    const heading = screen.getByRole("heading", { name: "Hello world" });
    fireEvent.focus(heading);
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(heading.textContent).toBe("Hello world");
  });

  it("commits typed text on blur", async () => {
    renderEditableHeading();

    const heading = screen.getByRole("heading", { name: "Hello world" });
    fireEvent.focus(heading);
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    heading.textContent = "Hello world abc";
    fireEvent.input(heading);
    fireEvent.blur(heading);

    expect(heading.textContent).toBe("Hello world abc");
  });

  it("preserves line breaks the browser represents as markup", async () => {
    renderEditableHeading();

    const heading = screen.getByRole("heading", { name: "Hello world" });
    fireEvent.focus(heading);
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    heading.innerHTML = "line one<div>line two</div><div>line three</div>";
    Object.defineProperty(heading, "innerText", {
      configurable: true,
      get: () => "line one\nline two\nline three",
    });
    fireEvent.input(heading);
    fireEvent.blur(heading);

    expect(heading.textContent).toBe("line one\nline two\nline three");
  });

  it("renders stored newlines with pre-wrap so they stay visible", () => {
    render(
      <CmsAuthProvider
        value={{ isAdmin: false, isEditing: false, toggleEdit: vi.fn() }}
      >
        <PageProvider
          transport={inMemoryTransport()}
          initialItems={{ sections: [{ id: "hero", heading: "a\nb" }] }}
        >
          <ContentEditSpan
            as="h1"
            collection="sections"
            itemId="hero"
            fieldKey="heading"
          />
        </PageProvider>
      </CmsAuthProvider>,
    );

    const heading = screen.getByRole("heading");
    expect(heading.style.whiteSpace).toBe("pre-wrap");
    expect(heading.textContent).toBe("a\nb");
  });
});
