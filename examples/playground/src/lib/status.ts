let message = "";
const listeners = new Set<() => void>();

export const statusStore = {
  get: () => message,
  set(next: string) {
    message = next;
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
