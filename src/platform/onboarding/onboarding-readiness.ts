export const REQUIRED_ONBOARDING_STEPS = ["club-profile", "activities", "policies"] as const;

export function missingRequiredOnboardingStep(acknowledgedStepKeys: readonly string[]): string | null {
  return REQUIRED_ONBOARDING_STEPS.find((step) => !acknowledgedStepKeys.includes(step)) ?? null;
}
