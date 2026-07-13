// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AnonymousEditProvider, useCmsAuth } from "../src/react/auth";

describe("AnonymousEditProvider", () => {
  it("toggles local editing without granting admin access", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AnonymousEditProvider>{children}</AnonymousEditProvider>
    );
    const { result } = renderHook(() => useCmsAuth(), { wrapper });

    expect(result.current).toMatchObject({ isAdmin: false, isEditing: false });
    act(() => result.current.toggleEdit());
    expect(result.current).toMatchObject({ isAdmin: false, isEditing: true });
  });
});
