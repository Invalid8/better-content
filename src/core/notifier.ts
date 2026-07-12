export interface Notifier {
  success: (message: string) => void;
  error: (message: string) => void;
}

export const consoleNotifier: Notifier = {
  success: (m) => console.info(`[cms] ${m}`),
  error: (m) => console.error(`[cms] ${m}`),
};
