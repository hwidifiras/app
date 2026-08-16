import type { ClubDay } from "@/lib/club-working-days";

export type OnboardingProfile = "CLASS_ONLY" | "GYM_ONLY" | "HYBRID";

export type OnboardingTemplate = {
  key: string;
  label: string;
  description: string;
  editions: Array<"CLASS" | "GYM" | "HYBRID">;
  suggestedDisciplines: string[];
  suggestedPlanTemplates: string[];
  keywords: string[];
};

export type TenantOnboardingState = {
  status: "IN_PROGRESS" | "COMPLETED";
  source: "SELF_SERVE" | "MANUAL";
  lastStepKey: string | null;
  acknowledgedStepKeys: string[];
  selectedTemplateKeys: string[];
  selectedDisciplineNames: string[];
  suggestedDisciplines: string[];
  templates: OnboardingTemplate[];
  profile: OnboardingProfile;
  modules: Array<"CLASS_MANAGEMENT" | "GYM_ACCESS">;
  club: {
    name: string;
    phone: string;
    address: string;
    workingDays: ClubDay[];
  };
  policies: {
    allowCheckInWithPartialPayment: boolean;
    absentConsumesSession: boolean;
    gymAllowCheckInWithPartialPayment: boolean;
    gymAllowExceptionalAccess: boolean;
  };
  existingDisciplines: Array<{ id: string; name: string }>;
};

export type OnboardingProfileInput = {
  action: "PROFILE";
  clubName: string;
  clubPhone: string;
  clubAddress: string;
  workingDays: ClubDay[];
};

export type OnboardingActivitiesInput = {
  action: "ACTIVITIES";
  templateKeys: string[];
  disciplineNames: string[];
};

export type OnboardingPoliciesInput = {
  action: "POLICIES";
  allowCheckInWithPartialPayment: boolean;
  absentConsumesSession: boolean;
  gymAllowCheckInWithPartialPayment: boolean;
  gymAllowExceptionalAccess: boolean;
};

export type OnboardingMutationInput =
  | OnboardingProfileInput
  | OnboardingActivitiesInput
  | OnboardingPoliciesInput
  | { action: "COMPLETE" };
