"use client";

import {
  createContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createCmsEngine,
  type CmsEngine,
  type CmsEngineOptions,
  type CmsSnapshot,
} from "better-content/core";

export type PageContextValue = CmsEngine &
  CmsSnapshot & { engine: CmsEngine };

export const PageContext = createContext<PageContextValue | undefined>(
  undefined,
);

export interface PageProviderProps extends CmsEngineOptions {
  children: ReactNode;
}

export const PageProvider = ({ children, ...options }: PageProviderProps) => {
  const [engine] = useState(() => createCmsEngine(options));
  const snapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    engine.getSnapshot,
  );
  const value = useMemo(
    () => ({ ...engine, ...snapshot, engine }),
    [engine, snapshot],
  );

  return <PageContext.Provider value={value}>{children}</PageContext.Provider>;
};
