import { describe, expect, it } from "vitest";

import {
  ACTIVITY_TEMPLATE_CATALOG_VERSION,
  ACTIVITY_TEMPLATES,
  activityTemplatesForEdition,
  resolveActivityTemplateKeys,
} from "@/platform/onboarding/activity-templates";
import { ACCESS_CREDENTIAL_MEDIA } from "@/modules/gym/credential-media";

describe("activity setup templates", () => {
  it("offers useful class-only variations including yoga", () => {
    const classTemplates = activityTemplatesForEdition("CLASS");
    expect(classTemplates.map((template) => template.key)).toContain("martial-arts-dojo");
    expect(classTemplates.map((template) => template.key)).toContain("yoga-wellness-studio");
    expect(classTemplates.every((template) => template.editions.includes("CLASS"))).toBe(true);
  });

  it("does not offer a class-only template to a gym-only workspace", () => {
    expect(resolveActivityTemplateKeys(["yoga-wellness-studio", "fitness-gym"], "GYM")).toEqual([
      "fitness-gym",
    ]);
  });

  it("has stable unique keys and a versioned catalogue", () => {
    expect(ACTIVITY_TEMPLATE_CATALOG_VERSION).toBe(1);
    expect(new Set(ACTIVITY_TEMPLATES.map((template) => template.key)).size).toBe(ACTIVITY_TEMPLATES.length);
  });
});

describe("access credential media", () => {
  it("keeps QR and barcode token-based while RFID media use external identifiers", () => {
    const encodingByMedium = Object.fromEntries(
      ACCESS_CREDENTIAL_MEDIA.map((definition) => [definition.medium, definition.encoding]),
    );
    expect(encodingByMedium.QR_CODE).toBe("SIGNED_APP_TOKEN");
    expect(encodingByMedium.BARCODE).toBe("SIGNED_APP_TOKEN");
    expect(encodingByMedium.RFID_CARD).toBe("EXTERNAL_IDENTIFIER");
    expect(encodingByMedium.RFID_WRISTBAND).toBe("EXTERNAL_IDENTIFIER");
  });
});
