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

describe("ContentEditSpan with renderValue", () => {
  afterEach(() => {
    cleanup();
  });

  // The portfolio renders its own markup from the stored string, so on blur
  // the element goes from user-owned plain text back to React-owned nodes.
  const renderMarkup = (raw: string) => (
    <>
      {raw.split("**").map((part, i) =>
        i % 2 ? <strong key={i}>{part}</strong> : part,
      )}
    </>
  );

  const renderEditable = (initial: string) =>
    render(
      <CmsAuthProvider
        value={{ isAdmin: false, isEditing: true, toggleEdit: vi.fn() }}
      >
        <PageProvider
          transport={inMemoryTransport()}
          initialItems={{ sections: [{ id: "hero", heading: initial }] }}
        >
          <ContentEditSpan
            as="h1"
            collection="sections"
            itemId="hero"
            fieldKey="heading"
            renderValue={renderMarkup}
          />
        </PageProvider>
      </CmsAuthProvider>,
    );

  it("does not leave the raw draft behind next to the rendered value", async () => {
    renderEditable("A **bold** claim");
    const heading = screen.getByRole("heading");

    // Rendered before editing: the ** markers are consumed by renderValue.
    expect(heading.textContent).toBe("A bold claim");

    fireEvent.focus(heading);
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    // Focused: the raw string is handed to the user to edit.
    expect(heading.textContent).toBe("A **bold** claim");

    heading.textContent = "A **bolder** claim";
    fireEvent.input(heading);
    fireEvent.blur(heading);
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    // On blur React re-renders the value. The raw text the user was editing
    // must be gone, not sitting in front of the rendered nodes.
    expect(heading.textContent).toBe("A bolder claim");
    expect(heading.querySelectorAll("strong")).toHaveLength(1);
  });

  it("survives a second focus and blur", async () => {
    renderEditable("A **bold** claim");
    const heading = screen.getByRole("heading");

    for (const next of ["A **first** claim", "A **second** claim"]) {
      fireEvent.focus(heading);
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      heading.textContent = next;
      fireEvent.input(heading);
      fireEvent.blur(heading);
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    }

    expect(heading.textContent).toBe("A second claim");
  });
});
