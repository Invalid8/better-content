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
});
