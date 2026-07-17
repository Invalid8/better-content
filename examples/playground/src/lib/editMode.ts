const KEY = "bc-playground-editing";

let editing =
  typeof sessionStorage !== "undefined" && sessionStorage.getItem(KEY) === "1";
const listeners = new Set<() => void>();

if (editing && typeof document !== "undefined") {
  document.documentElement.classList.add("editing-on");
}

export const editMode = {
  get: () => editing,
  toggle() {
    editing = !editing;
    sessionStorage.setItem(KEY, editing ? "1" : "0");
    document.documentElement.classList.toggle("editing-on", editing);
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export const editModeStore = {
  subscribe(run: (value: boolean) => void) {
    run(editing);
    return editMode.subscribe(() => run(editing));
  },
};
