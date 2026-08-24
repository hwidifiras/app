import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("UI system regression contract", () => {
  it("keeps semantic canvas, overlay, state, focus, and reduced-motion tokens", () => {
    const css = source("src/app/globals.css");

    for (const token of [
      "--canvas:",
      "--surface:",
      "--overlay:",
      "--danger-surface:",
      "--success-surface:",
      "--warning-surface:",
      "--focus-ring:",
    ]) {
      expect(css).toContain(token);
    }
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("routes custom modal behavior through the accessible dialog primitive", () => {
    const dialogFiles = [
      "src/components/ui/confirm-dialog.tsx",
      "src/components/ui/list-controls.tsx",
      "src/components/ui/notice-dialog.tsx",
      "src/components/sessions/session-edit-modal.tsx",
      "src/components/attendance/check-in-drawer.tsx",
      "src/components/members/member-danger-actions.tsx",
      "src/components/notifications/notification-center.tsx",
    ];

    for (const file of dialogFiles) {
      const contents = source(file);
      expect(contents, file).toContain("useAccessibleDialog");
      expect(contents, file).not.toMatch(/bg-(?:black|slate)-\d+/);
    }
  });

  it("keeps tenant navigation and reception fields free of legacy hard-coded presentation", () => {
    const sidebar = source("src/components/layout/app-sidebar.tsx");
    const login = source("src/app/login/page.tsx");
    const dashboard = source("src/app/page.tsx");
    const gymCheckIn = source("src/components/gym/gym-check-in-panel.tsx");

    expect(sidebar).not.toContain("/we-discipline/navbar-logo.png");
    expect(login).not.toContain("/we-discipline/navbar-logo.png");
    expect(dashboard).not.toContain("/we-discipline/");
    expect(gymCheckIn).not.toMatch(/className="input(?:\s|")/);
  });

  it("keeps operational alert and payment escape controls explicit", () => {
    const notifications = source("src/components/notifications/notification-center.tsx");
    const paymentForm = source("src/components/payments/payment-add-form.tsx");
    const paymentPage = source("src/app/payments/new/page.tsx");

    expect(notifications).toContain("size-11");
    expect(notifications).toContain("aria-controls");
    expect(notifications).toContain("Marquer comme lues");
    expect(paymentForm).not.toContain('router.push("/payments")');
    expect(paymentForm).toContain("router.push(returnPath)");
    expect(paymentPage).toContain("resolvePaymentReturnPath");
  });

  it("keeps member tablet cards and enrollment task order responsive", () => {
    const memberList = source("src/components/members/member-list-client.tsx");
    const memberCard = source("src/components/members/member-card.tsx");
    const enrollmentWizard = source("src/components/enrollment/enrollment-wizard.tsx");
    const enrollmentSummary = source("src/components/enrollment/enrollment-summary-sidebar.tsx");
    const enrollmentLine = source("src/components/enrollment/enrollment-line-editor.tsx");

    expect(memberList).toContain("sm:grid-cols-2 xl:hidden");
    expect(memberList).toContain("hidden overflow-x-auto xl:block");
    expect(memberList).toContain("lg:top-[4.5rem]");
    expect(memberCard).toContain("min-h-11");

    expect(enrollmentSummary).not.toContain("order-first");
    expect(enrollmentWizard).toContain("xl:grid-cols-[minmax(0,1fr)_22rem]");
    expect(enrollmentWizard).toContain("xl:top-[5.5rem]");
    expect(enrollmentWizard.indexOf("<EnrollmentSummarySidebar")).toBeGreaterThan(
      enrollmentWizard.indexOf("{step === 1"),
    );
    expect(enrollmentLine).toContain('name={`${line.key}-mode`}');
  });
});
