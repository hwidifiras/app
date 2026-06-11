import { describe, expect, it } from "vitest";

describe("subscription plan template pricing", () => {
  function applyTemplatePrice(
    price: string,
    validityDays: string,
    months: 1 | 2 | 3,
  ): string | null {
    const currentPrice = parseFloat(price.replace(",", ".")) || 0;
    const currentDays = parseInt(validityDays, 10) || 30;
    if (currentPrice <= 0 || currentDays <= 0) return null;
    const monthlyRate = currentPrice / (currentDays / 30);
    return (monthlyRate * months).toFixed(2);
  }

  it("computes 2 months from a 1-month base without cumulative drift", () => {
    expect(applyTemplatePrice("50", "30", 2)).toBe("100.00");
    expect(applyTemplatePrice("100", "60", 3)).toBe("150.00");
  });

  it("is idempotent when clicking the same template repeatedly", () => {
    const once = applyTemplatePrice("50", "30", 2);
    expect(once).toBe("100.00");
    expect(applyTemplatePrice(once ?? "", "60", 2)).toBe("100.00");
  });
});
