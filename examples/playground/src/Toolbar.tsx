import { useCmsAuth, usePageContext } from "better-content/react";

export function Toolbar({
  status,
  disabled = false,
}: {
  status: string;
  disabled?: boolean;
}) {
  const { isEditing, toggleEdit } = useCmsAuth();
  const { hasUnsavedChanges, saving, saveAll } = usePageContext();

  return (
    <header className="toolbar">
      <div className="brand">
        better-content <span>/ live demo</span>
      </div>
      <span className="status" role="status">
        {status}
      </span>
      <button
        className={isEditing ? "btn editing" : "btn"}
        onClick={toggleEdit}
        disabled={disabled}
        aria-pressed={isEditing}
      >
        {isEditing ? "Editing" : "Edit"}
      </button>
      <button
        className="btn primary"
        onClick={() => void saveAll()}
        disabled={disabled || !hasUnsavedChanges || saving}
      >
        {saving ? "Saving…" : "Save"}
        {hasUnsavedChanges && !saving && <span className="dirty-dot" />}
      </button>
    </header>
  );
}
