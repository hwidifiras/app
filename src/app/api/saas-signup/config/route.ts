import { ACTIVITY_TEMPLATES, ACTIVITY_TEMPLATE_CATALOG_VERSION } from "@/platform/onboarding/activity-templates";
import { noStoreJson, signupErrorResponse } from "@/platform/signup/signup-api";
import { resolveSaasSignupConfig } from "@/platform/signup/signup-config";
import { requirePlatformRequest } from "@/platform/signup/platform-request";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requirePlatformRequest(request);
    const config = resolveSaasSignupConfig();
    return noStoreJson({
      data: {
        enabled: config.mode !== "DISABLED",
        inviteOnly: config.mode === "INVITE_ONLY",
        trialDays: config.trialDays,
        antiBot: {
          provider: config.antiBotProvider,
          siteKey: config.antiBotSiteKey,
        },
        editions: ["CLASS", "GYM", "HYBRID"],
        templateCatalogVersion: ACTIVITY_TEMPLATE_CATALOG_VERSION,
        activityTemplates: ACTIVITY_TEMPLATES,
      },
    });
  } catch (error) {
    return signupErrorResponse(error);
  }
}
