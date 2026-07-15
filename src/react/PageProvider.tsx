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

export const EngineContext = createContext<CmsEngine | undefined>(undefined);

export type PageProviderProps = {
  children: ReactNode;
} & (
  | ({ engine: CmsEngine } & Partial<CmsEngineOptions>)
  | ({ engine?: undefined } & CmsEngineOptions)
);

export const PageProvider = ({
  children,
  engine: providedEngine,
  ...options
}: PageProviderProps) => {
  const [engine] = useState(
    () => providedEngine ?? createCmsEngine(options as CmsEngineOptions),
  );
  const snapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    engine.getSnapshot,
  );
  const value = useMemo(
    () => ({ ...engine, ...snapshot, engine }),
    [engine, snapshot],
  );

  return (
    <EngineContext.Provider value={engine}>
      <PageContext.Provider value={value}>{children}</PageContext.Provider>
    </EngineContext.Provider>
  );
};
