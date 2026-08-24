import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("demo read-only UI", () => {
  it("explains which interactions remain available", () => {
    const banner = source("src/components/layout/demo-workspace-banner.tsx");

    expect(banner).toContain("Lecture seule");
    expect(banner).toContain("recherche, filtres et navigation restent disponibles");
    expect(banner).toContain("Enregistrer, envoyer et supprimer sont désactivés");
  });

  it("guards shared save and confirmation surfaces without blocking all forms", () => {
    const formLayout = source("src/components/ui/form-layout.tsx");
    const guard = source("src/components/ui/demo-read-only.tsx");
    const confirmDialog = source("src/components/ui/confirm-dialog.tsx");

    expect(formLayout).toContain("DemoReadOnlyFormActions");
    expect(guard).toContain('closest("form")');
    expect(guard).toContain('(button.props.type ?? "submit") !== "submit"');
    expect(guard).toContain('"data-demo-mutation": "submit"');
    expect(confirmDialog).toContain("DemoMutationButton");
    expect(guard).not.toContain("pointerEvents");
    expect(guard).not.toContain("querySelectorAll");
  });

  it("guards every standalone subscription correction mutation", () => {
    const subscriptionEdit = source("src/components/subscriptions/subscription-edit-form.tsx");

    expect(subscriptionEdit).toContain("const demoReadOnly = useDemoReadOnly()");
    expect(subscriptionEdit).toContain("if (demoReadOnly)");
    expect(subscriptionEdit).toContain("setMessage(DEMO_READ_ONLY_MESSAGE)");
    expect(subscriptionEdit.match(/<DemoMutationButton/g)).toHaveLength(5);
    expect(subscriptionEdit).not.toMatch(/<button[^>]+onClick=\{(?:adjustUnits|replaceSale)/);
  });

  it("guards every unsafe data-import request, including preview POSTs", () => {
    const wizard = source("src/components/settings/data-import-wizard.tsx");
    const bulkSection = source("src/components/settings/data-import-bulk-section.tsx");
    const statusUi = source("src/components/settings/data-import-status-ui.tsx");

    expect(wizard).toContain("const demoReadOnly = useDemoReadOnly()");
    expect(wizard).toContain("setMessage(DEMO_READ_ONLY_MESSAGE)");
    expect(wizard).toMatch(/async function modeAction[\s\S]*?if \(blockDemoMutation\(\)\) return;[\s\S]*?fetch\("\/api\/data-import"/);
    expect(wizard).toMatch(/async function rollback[\s\S]*?if \(blockDemoMutation\(\)\) return;[\s\S]*?window\.confirm/);
    expect(wizard).toMatch(/async function submit\(action[\s\S]*?if \(blockDemoMutation\(\)\) return;[\s\S]*?fetch\("\/api\/data-import"/);
    expect(wizard).toMatch(/async function submitBulk[\s\S]*?if \(blockDemoMutation\(\)\) return;[\s\S]*?fetch\("\/api\/data-import\/bulk"/);
    expect(wizard).toContain("<DemoMutationButton");
    expect(bulkSection.match(/<DemoMutationButton/g)).toHaveLength(2);
    expect(statusUi.match(/<DemoMutationButton/g)).toHaveLength(2);
    expect(bulkSection).not.toContain("<button type=\"button\"");
  });
});
