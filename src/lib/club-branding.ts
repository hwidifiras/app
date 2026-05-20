import { getAppName } from "@/lib/app-name";
import type { ClubSettingsData } from "@/lib/club-settings";

export type ClubBranding = {
  /** Club name from settings, or product name (GymDay) when empty. */
  displayName: string;
  /** Product name (env APP_NAME). Shown as subtitle when a custom club name is set. */
  appName: string;
  logoUrl: string | null;
};

function safeTrim(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveClubBranding(
  settings: Partial<Pick<ClubSettingsData, "clubName" | "clubLogoUrl">>,
): ClubBranding {
  const appName = getAppName();
  const customName = safeTrim(settings.clubName);
  const logo = safeTrim(settings.clubLogoUrl);

  return {
    displayName: customName || appName,
    appName,
    logoUrl: logo || null,
  };
}
