import { ACTIVITY_TEMPLATES, ACTIVITY_TEMPLATE_CATALOG_VERSION } from "@/platform/onboarding/activity-templates";
import { resolveTenantHostConfig } from "@/lib/tenant-host";
import { noStoreJson, signupErrorResponse } from "@/platform/signup/signup-api";
import { resolveSaasSignupConfig } from "@/platform/signup/signup-config";
import { requirePlatformRequest } from "@/platform/signup/platform-request";
import { workspaceUrlForSlug } from "@/platform/signup/workspace-slug";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requirePlatformRequest(request);
    const config = resolveSaasSignupConfig();
    const hostConfig = resolveTenantHostConfig();
    return noStoreJson({
      data: {
        enabled: config.mode !== "DISABLED",
        inviteOnly: config.mode === "INVITE_ONLY",
        trialDays: config.trialDays,
        workspaceDomain: hostConfig.rootDomain,
        workspaceExampleUrl: workspaceUrlForSlug("mon-club"),
        antiBot: {
          provider: config.antiBotProvider,
          siteKey: config.antiBotSiteKey,
        },
        legal: {
          termsUrl: config.termsUrl,
          privacyUrl: config.privacyUrl,
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
