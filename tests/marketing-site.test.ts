import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { isPublicPath, isTenantIndependentPublicPath } from "@/lib/public-paths";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public martial-arts marketing experience", () => {
  it("keeps the interactive demo public without exposing private app routes", () => {
    const appShell = source("src/components/layout/app-shell.tsx");

    expect(isPublicPath("/demo")).toBe(true);
    expect(isTenantIndependentPublicPath("/accueil")).toBe(true);
    expect(isTenantIndependentPublicPath("/demo")).toBe(true);
    expect(isTenantIndependentPublicPath("/login")).toBe(false);
    expect(isPublicPath("/members")).toBe(false);
    expect(isPublicPath("/payments/new")).toBe(false);
    expect(appShell).toContain('pathname === "/demo"');
  });

  it("uses the three-offer structure without legacy belt or gym positioning", () => {
    const homepage = source("src/components/marketing/we-discipline-homepage.tsx");

    expect(homepage).toContain('name: "Essentiel"');
    expect(homepage).toContain('name: "Club"');
    expect(homepage).toContain('name: "Académie"');
    expect(homepage).not.toMatch(/ceinture|belt/iu);
    expect(homepage).not.toMatch(/\bgym\b/iu);
  });

  it("ships optimized visuals for QR, RFID card, and wristband options", () => {
    for (const asset of [
      "public/we-discipline/access-qr.webp",
      "public/we-discipline/access-rfid-card.webp",
      "public/we-discipline/access-rfid-wristband.webp",
    ]) {
      expect(existsSync(resolve(process.cwd(), asset)), asset).toBe(true);
    }
  });
});
