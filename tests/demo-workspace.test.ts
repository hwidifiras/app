import { describe, expect, it } from "vitest";

import {
  configuredDemoTenantSlugs,
  demoAccountEmail,
  demoPublicRequestOrigin,
  demoWorkspaceEntryUrl,
  isDemoMutationAllowed,
  isDemoTenantSlug,
  safeDemoNextPath,
} from "@/lib/demo-workspace";

describe("public demo workspace safeguards", () => {
  const env = {
    SAAS_DEMO_TENANT_SLUGS: "martial-demo, second-demo",
    SAAS_DEMO_ACCOUNT_EMAIL: " Demo@Example.test ",
    SAAS_DEMO_WORKSPACE_URL: "https://martial-demo.example.test/welcome?old=1",
  };

  it("requires an explicit tenant allow-list", () => {
    expect([...configuredDemoTenantSlugs(env)]).toEqual(["martial-demo", "second-demo"]);
    expect(isDemoTenantSlug("MARTIAL-DEMO", env)).toBe(true);
    expect(isDemoTenantSlug("client-club", env)).toBe(false);
    expect(isDemoTenantSlug("martial-demo", {})).toBe(false);
  });

  it("builds the one-click entry URL and normalizes the demo account", () => {
    expect(demoAccountEmail(env)).toBe("demo@example.test");
    expect(demoWorkspaceEntryUrl(env)).toBe(
      "https://martial-demo.example.test/api/auth/demo?next=%2F",
    );
    expect(demoWorkspaceEntryUrl({ SAAS_DEMO_WORKSPACE_URL: "javascript:alert(1)" })).toBeNull();
  });

  it("keeps redirects on the demo origin", () => {
    expect(safeDemoNextPath("/members?status=active")).toBe("/members?status=active");
    expect(safeDemoNextPath("https://attacker.example")).toBe("/");
    expect(safeDemoNextPath("//attacker.example/path")).toBe("/");
    expect(safeDemoNextPath("/\\attacker.example/path")).toBe("/");
  });

  it("allows only authentication lifecycle mutations", () => {
    expect(isDemoMutationAllowed("/api/auth/demo")).toBe(true);
    expect(isDemoMutationAllowed("/api/auth/login")).toBe(true);
    expect(isDemoMutationAllowed("/api/auth/logout")).toBe(true);
    expect(isDemoMutationAllowed("/api/payments")).toBe(false);
    expect(isDemoMutationAllowed("/settings/club")).toBe(false);
  });

  it("uses the validated public reverse-proxy origin", () => {
    expect(demoPublicRequestOrigin({
      requestUrl: "http://localhost:3000/api/auth/demo?next=%2F",
      hostHeader: "localhost:3000",
      forwardedHostHeader: "martial-demo.example.test",
      forwardedProtocolHeader: "https",
      resolvedHost: "martial-demo.example.test",
    })).toBe("https://martial-demo.example.test");

    expect(demoPublicRequestOrigin({
      requestUrl: "http://localhost:3000/api/auth/demo",
      hostHeader: "client.example.test",
      forwardedHostHeader: "attacker.example.test",
      forwardedProtocolHeader: "https",
      resolvedHost: "client.example.test",
    })).toBe("http://localhost:3000");
  });
});
