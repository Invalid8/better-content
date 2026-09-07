import { useEffect, useState } from "react";
import type { CmsEngine } from "better-content/core";
import { ready } from "../../lib/engine";
import { editMode } from "../../lib/editMode";

export function useLiveEngine() {
  const [engine, setEngine] = useState<CmsEngine | null>(null);
  const [isEditing, setIsEditing] = useState(editMode.get());

  useEffect(() => {
    void ready.then(setEngine);
    return editMode.subscribe(() => setIsEditing(editMode.get()));
  }, []);

  return { engine, isEditing };
}
