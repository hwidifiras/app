import { ACTIVITY_TEMPLATES } from "@/platform/onboarding/activity-templates";
import { resolveTenantHostConfig } from "@/lib/tenant-host";
import type { SignupPublicConfig } from "@/components/signup/signup-types";
import { resolveSaasSignupConfig } from "@/platform/signup/signup-config";
import { workspaceUrlForSlug } from "@/platform/signup/workspace-slug";

export function getPublicSignupConfig(): SignupPublicConfig {
  const signup = resolveSaasSignupConfig();
  const host = resolveTenantHostConfig();

  return {
    enabled: signup.mode !== "DISABLED",
    inviteOnly: signup.mode === "INVITE_ONLY",
    trialDays: signup.trialDays,
    workspaceDomain: host.rootDomain,
    workspaceExampleUrl: workspaceUrlForSlug("mon-club"),
    antiBot: {
      provider: signup.antiBotProvider,
      siteKey: signup.antiBotSiteKey,
    },
    legal: {
      termsUrl: signup.termsUrl,
      privacyUrl: signup.privacyUrl,
    },
    activityTemplates: ACTIVITY_TEMPLATES.map((template) => ({
      ...template,
      editions: [...template.editions],
      suggestedDisciplines: [...template.suggestedDisciplines],
      suggestedPlanTemplates: [...template.suggestedPlanTemplates],
      keywords: [...template.keywords],
    })),
  };
}
