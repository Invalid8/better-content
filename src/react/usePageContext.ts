"use client";

import { useContext } from "react";
import { PageContext, type PageContextValue } from "./PageProvider";

export const usePageContext = (): PageContextValue => {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error("usePageContext must be used within a PageProvider");
  }
  return context;
};
