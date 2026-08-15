import { describe, expect, it } from "vitest";

import { resolveTenantBootstrapConfig } from "../scripts/lib/tenant-bootstrap.mjs";

describe("resolveTenantBootstrapConfig", () => {
  const defaults = {
    DEFAULT_TENANT_ID: "tenant_we_discipline",
    DEFAULT_TENANT_NAME: "We Discipline",
    DEFAULT_TENANT_ROOT_ALIAS: "we-discipline.com",
    DEFAULT_TENANT_SLUG: "we-discipline",
  };

  it("does not leak first-tenant defaults into a new explicit tenant", () => {
    expect(
      resolveTenantBootstrapConfig({
        ...defaults,
        TENANT_NAME: "Gym Acceptance",
        TENANT_SLUG: "accept-gym",
      }),
    ).toEqual({
      id: "tenant_accept-gym",
      name: "Gym Acceptance",
      rootDomainAlias: null,
      slug: "accept-gym",
    });
  });

  it("keeps configured defaults for the default tenant", () => {
    expect(resolveTenantBootstrapConfig(defaults)).toEqual({
      id: "tenant_we_discipline",
      name: "We Discipline",
      rootDomainAlias: "we-discipline.com",
      slug: "we-discipline",
    });
  });

  it("accepts an explicit alias and lets an empty alias clear it", () => {
    expect(
      resolveTenantBootstrapConfig({
        ...defaults,
        TENANT_ROOT_DOMAIN_ALIAS: "gym.example.test",
        TENANT_SLUG: "accept-gym",
      }).rootDomainAlias,
    ).toBe("gym.example.test");
    expect(
      resolveTenantBootstrapConfig({
        ...defaults,
        TENANT_ROOT_DOMAIN_ALIAS: "",
        TENANT_SLUG: "we-discipline",
      }).rootDomainAlias,
    ).toBeNull();
  });
});
