export type DisplayMode = "wide" | "compact";

export const DISPLAY_MODE_STORAGE_KEY = "app-display-mode";

export function isDisplayMode(value: string | null): value is DisplayMode {
  return value === "wide" || value === "compact";
}
