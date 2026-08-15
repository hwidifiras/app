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
});
