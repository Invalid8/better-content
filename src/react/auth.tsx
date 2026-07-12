"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { CmsAuthState } from "better-content/core";

export const CmsAuthContext = createContext<CmsAuthState | undefined>(
  undefined,
);

export function useCmsAuth(): CmsAuthState {
  const ctx = useContext(CmsAuthContext);
  if (!ctx) {
    throw new Error(
      "useCmsAuth must be used within a CmsAuthProvider (or a built-in auth provider).",
    );
  }
  return ctx;
}

export function CmsAuthProvider({
  value,
  children,
}: {
  value: CmsAuthState;
  children: ReactNode;
}) {
  return (
    <CmsAuthContext.Provider value={value}>{children}</CmsAuthContext.Provider>
  );
}

export function AnonymousEditProvider({ children }: { children: ReactNode }) {
  const [isEditing, setIsEditing] = useState(false);
  const toggleEdit = useCallback(() => setIsEditing((value) => !value), []);

  return (
    <CmsAuthProvider value={{ isAdmin: false, isEditing, toggleEdit }}>
      {children}
    </CmsAuthProvider>
  );
}
