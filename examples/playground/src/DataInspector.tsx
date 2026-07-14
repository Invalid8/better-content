import type { DataAdapter } from "better-content/core";
import { usePageContext } from "better-content/react";
import { DataInspector as Inspector } from "better-content/devtools/react";

export function DataInspector({ adapter }: { adapter: DataAdapter }) {
  const { engine } = usePageContext();

  return (
    <Inspector
      adapter={adapter}
      engine={engine}
      collections={["sections", "cards"]}
    />
  );
}
