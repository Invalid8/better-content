import { useLiveEngine } from "./useLiveEngine";
import MarkdownCard from "./MarkdownCard";

export default function MarkdownIsland() {
  const { engine, isEditing } = useLiveEngine();

  if (!engine) return <p className="island-loading">starting React...</p>;

  return <MarkdownCard engine={engine} editing={isEditing} />;
}
