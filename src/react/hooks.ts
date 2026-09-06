"use client";

import { useCallback, useContext, useSyncExternalStore } from "react";
import type { CmsEngine, Item } from "better-content/core";
import { EngineContext } from "./PageProvider";

export function useCmsEngine(): CmsEngine {
  const engine = useContext(EngineContext);
  if (!engine) {
    throw new Error("useCmsEngine must be used within a PageProvider");
  }
  return engine;
}

export function useCmsItem<T = Record<string, unknown>>(
  collection: string,
  id: string,
): Item<T> | undefined {
  const engine = useCmsEngine();
  const getItem = useCallback(
    () => engine.getItem<T>(collection, id),
    [engine, collection, id],
  );
  return useSyncExternalStore(engine.subscribe, getItem, getItem);
}
