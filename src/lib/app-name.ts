/** Default product name (override with env `APP_NAME`). */
export const DEFAULT_APP_NAME = "GymDay";

export function getAppName(): string {
  return process.env.APP_NAME?.trim() || DEFAULT_APP_NAME;
}

/** Sidebar / mobile nav (client-safe; optional `NEXT_PUBLIC_APP_NAME`). */
export const APP_BRAND_NAME =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_NAME?.trim()) ||
  DEFAULT_APP_NAME;
