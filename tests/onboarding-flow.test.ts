import { describe, expect, it } from "vitest";

import { onboardingMutationSchema } from "@/platform/onboarding/onboarding-schemas";
import { missingRequiredOnboardingStep } from "@/platform/onboarding/onboarding-readiness";

describe("tenant onboarding input", () => {
  it("normalizes duplicate disciplines while preserving the first label", () => {
    const parsed = onboardingMutationSchema.parse({
      action: "ACTIVITIES",
      templateKeys: ["martial-arts-dojo", "martial-arts-dojo"],
      disciplineNames: [" Kick boxing ", "kick   boxing", "Judo"],
    });

    expect(parsed).toEqual({
      action: "ACTIVITIES",
      templateKeys: ["martial-arts-dojo"],
      disciplineNames: ["kick boxing", "Judo"],
    });
  });

  it("rejects unknown templates and an empty working week", () => {
    expect(onboardingMutationSchema.safeParse({
      action: "ACTIVITIES",
      templateKeys: ["invented-template"],
      disciplineNames: ["Yoga"],
    }).success).toBe(false);

    expect(onboardingMutationSchema.safeParse({
      action: "PROFILE",
      clubName: "Studio Tunis",
      clubPhone: "",
      clubAddress: "Tunis",
      workingDays: [],
    }).success).toBe(false);
  });

  it("accepts edition-neutral policy choices without inventing business data", () => {
    expect(onboardingMutationSchema.safeParse({
      action: "POLICIES",
      allowCheckInWithPartialPayment: true,
      absentConsumesSession: false,
      gymAllowCheckInWithPartialPayment: true,
      gymAllowExceptionalAccess: false,
    }).success).toBe(true);
  });
});

describe("tenant onboarding completion gate", () => {
  it("requires all persisted setup steps before completion", () => {
    expect(missingRequiredOnboardingStep([])).toBe("club-profile");
    expect(missingRequiredOnboardingStep(["club-profile"])).toBe("activities");
    expect(missingRequiredOnboardingStep(["club-profile", "activities"])).toBe("policies");
    expect(missingRequiredOnboardingStep(["club-profile", "activities", "policies"])).toBeNull();
  });
});
