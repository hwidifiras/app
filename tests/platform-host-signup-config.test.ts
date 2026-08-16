import { describe, expect, it } from "vitest";

import {
  isPlatformHost,
  resolveTenantHostConfig,
  tenantSlugFromHost,
} from "@/lib/tenant-host";
import { resolveSaasSignupConfig } from "@/platform/signup/signup-config";
import {
  normalizeWorkspaceSlug,
  validateWorkspaceSlug,
  workspaceUrlForSlug,
} from "@/platform/signup/workspace-slug";

const env = {
  SAAS_ROOT_DOMAIN: "we-discipline.com",
  DEFAULT_TENANT_SLUG: "first-client",
  PLATFORM_APP_URL: "https://app.we-discipline.com",
  SAAS_PLATFORM_HOSTS: "start.we-discipline.com",
  SAAS_RESERVED_SLUGS: "internal,pilot",
};

describe("platform and tenant host separation", () => {
  const config = resolveTenantHostConfig(env);

  it("keeps platform hosts out of tenant slug resolution", () => {
    expect(isPlatformHost("app.we-discipline.com", config)).toBe(true);
    expect(isPlatformHost("start.we-discipline.com:443", config)).toBe(true);
    expect(tenantSlugFromHost("app.we-discipline.com", config)).toBeNull();
    expect(tenantSlugFromHost("start.we-discipline.com", config)).toBeNull();
  });

  it("continues resolving root alias and tenant subdomains", () => {
    expect(tenantSlugFromHost("we-discipline.com", config)).toBe("first-client");
    expect(tenantSlugFromHost("dojo-tunis.we-discipline.com", config)).toBe("dojo-tunis");
    expect(tenantSlugFromHost("nested.dojo.we-discipline.com", config)).toBeNull();
  });
});

describe("workspace slug policy", () => {
  it("creates readable DNS-safe suggestions", () => {
    expect(normalizeWorkspaceSlug("Académie Élite Tunis")) .toBe("academie-elite-tunis");
    expect(workspaceUrlForSlug("academie-elite-tunis", env)).toBe(
      "https://academie-elite-tunis.we-discipline.com",
    );
  });

  it("keeps the configured development port for cross-host handoff", () => {
    expect(workspaceUrlForSlug("dojo-tunis", {
      SAAS_ROOT_DOMAIN: "localhost",
      PLATFORM_APP_URL: "http://app.localhost:3000",
    })).toBe("http://dojo-tunis.localhost:3000");
  });

  it.each(["app", "start", "support", "internal", "pilot"])("reserves %s", (slug) => {
    expect(validateWorkspaceSlug(slug, env)).toMatchObject({ valid: false, reason: "RESERVED" });
  });

  it("rejects empty and too-short slugs", () => {
    expect(validateWorkspaceSlug("---", env)).toMatchObject({ valid: false, reason: "EMPTY" });
    expect(validateWorkspaceSlug("ab", env)).toMatchObject({ valid: false, reason: "FORMAT" });
  });
});

describe("signup configuration", () => {
  it("is disabled by default and bounds trial duration", () => {
    expect(resolveSaasSignupConfig({})).toMatchObject({
      mode: "DISABLED",
      trialDays: 14,
      antiBotProvider: "NONE",
    });
    expect(resolveSaasSignupConfig({ SAAS_SIGNUP_TRIAL_DAYS: "999" }).trialDays).toBe(90);
  });

  it("supports invite-only rollout and pluggable anti-bot providers", () => {
    expect(resolveSaasSignupConfig({
      SAAS_SIGNUP_MODE: "invite_only",
      SAAS_SIGNUP_TRIAL_DAYS: "21",
      NEXT_PUBLIC_SIGNUP_ANTI_BOT_PROVIDER: "recaptcha",
      NEXT_PUBLIC_SIGNUP_ANTI_BOT_SITE_KEY: "site-key",
      SIGNUP_ANTI_BOT_SECRET: "secret",
    })).toEqual({
      mode: "INVITE_ONLY",
      trialDays: 21,
      antiBotProvider: "RECAPTCHA",
      antiBotSiteKey: "site-key",
      antiBotSecretConfigured: true,
    });
  });
});
