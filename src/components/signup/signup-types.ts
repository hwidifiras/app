export type SignupEdition = "CLASS" | "GYM" | "HYBRID";

export type SignupActivityTemplate = {
  key: string;
  label: string;
  description: string;
  editions: SignupEdition[];
  suggestedDisciplines: string[];
  suggestedPlanTemplates: string[];
  keywords: string[];
};
export type SignupPublicConfig = {
  enabled: boolean;
  inviteOnly: boolean;
  trialDays: number;
  workspaceDomain: string;
  workspaceExampleUrl: string;
  antiBot: {
    provider: "NONE" | "TURNSTILE" | "RECAPTCHA";
    siteKey: string | null;
  };
  legal: {
    termsUrl: string | null;
    privacyUrl: string | null;
  };
  activityTemplates: SignupActivityTemplate[];
};

export type SignupState = {
  signupId: string;
  status: "PENDING_EMAIL" | "VERIFIED" | "PROVISIONING" | "COMPLETED" | "EXPIRED" | "FAILED";
  email: string;
  ownerName: string;
  emailVerified: boolean;
  clubName: string | null;
  clubPhone: string;
  clubAddress: string;
  requestedSlug: string | null;
  edition: SignupEdition | null;
  activityTemplateKeys: string[];
  tenantId: string | null;
  expiresAt: string;
};

export type SignupClubDraft = {
  clubName: string;
  clubPhone: string;
  clubAddress: string;
  slug: string;
};

export type WorkspaceHandoffPayload = {
  actionUrl: string;
  workspaceUrl: string;
  token: string;
  userId: string;
};
