import { describe, expect, it } from "vitest";

import {
  buildProductCapabilities,
  deriveProductProfile,
} from "@/platform/product/product-context";
import {
  productRouteForPath,
  requiredProductModuleForPath,
} from "@/platform/product/product-registry";

describe("tenant product profiles", () => {
  it("derives the three editions from enabled modules", () => {
    expect(deriveProductProfile(["CLASS_MANAGEMENT"])).toBe("CLASS_ONLY");
    expect(deriveProductProfile(["GYM_ACCESS"])).toBe("GYM_ONLY");
    expect(deriveProductProfile(["CLASS_MANAGEMENT", "GYM_ACCESS"])).toBe("HYBRID");
  });

  it("rejects a tenant without any product module", () => {
    expect(() => deriveProductProfile([])).toThrow("TENANT_PRODUCT_UNCONFIGURED");
  });

  it("only exposes mixed sales when both modules are active", () => {
    expect(buildProductCapabilities(["CLASS_MANAGEMENT"])).toMatchObject({
      classManagement: true,
      gymAccess: false,
      mixedSales: false,
    });
    expect(buildProductCapabilities(["GYM_ACCESS"])).toMatchObject({
      classManagement: false,
      gymAccess: true,
      mixedSales: false,
    });
    expect(buildProductCapabilities(["CLASS_MANAGEMENT", "GYM_ACCESS"]).mixedSales).toBe(true);
  });
});

describe("product route registry", () => {
  it("gates class and gym routes independently", () => {
    expect(requiredProductModuleForPath("/attendance/today")).toBe("CLASS_MANAGEMENT");
    expect(requiredProductModuleForPath("/api/sessions/session-1")).toBe("CLASS_MANAGEMENT");
    expect(requiredProductModuleForPath("/members/member-1/add-to-group")).toBe("CLASS_MANAGEMENT");
    expect(requiredProductModuleForPath("/gym/check-in")).toBe("GYM_ACCESS");
    expect(requiredProductModuleForPath("/api/gym/visits/visit-1")).toBe("GYM_ACCESS");
  });

  it("keeps shared sales and member routes module-neutral", () => {
    expect(requiredProductModuleForPath("/enrollment")).toBeNull();
    expect(requiredProductModuleForPath("/payments/new")).toBeNull();
    expect(requiredProductModuleForPath("/members/member-1")).toBeNull();
  });

  it("uses the most specific route metadata", () => {
    expect(productRouteForPath("/gym/visits")?.permission).toBe("gym.manage");
    expect(productRouteForPath("/gym/check-in")?.permission).toBe("gym.checkin");
    expect(productRouteForPath("/api/group-members/bulk")?.permission).toBe("enrollment.sell");
    expect(productRouteForPath("/api/enrollment/context")?.module).toBeNull();
    expect(productRouteForPath("/api/enrollment/context")?.permission).toBe("enrollment.sell");
    expect(productRouteForPath("/sessions")?.permission).toBe("class.attendance");
    expect(productRouteForPath("/settings/schedules")?.permission).toBe("settings.manage");
  });
});
