"use client";

import { createElement, useEffect, useRef } from "react";
import type { CmsEngine, DataAdapter } from "better-content/core";
import {
  DATA_INSPECTOR_TAG,
  registerDataInspector,
  type DataInspectorElement,
} from "better-content/devtools";

registerDataInspector();

export interface DataInspectorProps {
  adapter: DataAdapter;
  collections: string[];
  engine?: CmsEngine;
}

export function DataInspector({
  adapter,
  collections,
  engine,
}: DataInspectorProps) {
  const ref = useRef<DataInspectorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.adapter = adapter;
    el.engine = engine ?? null;
    el.collections = collections;
  }, [adapter, engine, collections]);

  useEffect(() => {
    return () => {
      if (ref.current) ref.current.engine = null;
    };
  }, []);

  return createElement(DATA_INSPECTOR_TAG, { ref });
}
