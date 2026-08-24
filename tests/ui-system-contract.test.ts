import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("UI system regression contract", () => {
  it("keeps the semantic design and shared sticky tokens", () => {
    const css = source("src/app/globals.css");

    for (const token of [
      "--canvas:",
      "--surface:",
      "--overlay:",
      "--danger-surface:",
      "--success-surface:",
      "--warning-surface:",
      "--focus-ring:",
      "--app-topbar-height:",
      "--app-sticky-offset:",
    ]) {
      expect(css).toContain(token);
    }
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");

    const topbarStickyFiles = [
      "src/components/attendance/attendance-history-list.tsx",
      "src/components/groups/group-list-client.tsx",
      "src/components/members/member-list-client.tsx",
      "src/components/payments/payments-table.tsx",
      "src/components/sessions/session-planner-filters.tsx",
      "src/components/subscriptions/subscriptions-list-client.tsx",
    ];

    for (const file of topbarStickyFiles) {
      const contents = source(file);
      expect(contents, file).toContain("lg:top-[var(--app-topbar-height)]");
      expect(contents, file).not.toMatch(/(?:lg|xl):top-\[(?:4\.5rem|5\.5rem)\]/);
    }

    const enrollmentWizard = source("src/components/enrollment/enrollment-wizard.tsx");
    expect(enrollmentWizard).toContain("xl:top-[var(--app-sticky-offset)]");
    expect(enrollmentWizard).not.toContain("xl:top-[5.5rem]");
  });

  it("server-bootstraps the tenant account into the shared app shell", () => {
    const layout = source("src/app/layout.tsx");
    const shell = source("src/components/layout/app-shell.tsx");
    const provider = source("src/components/layout/app-shell-data-provider.tsx");

    expect(layout).toContain("let initialAccount: AccountData | null = null");
    expect(layout).toMatch(/initialAccount = \{[\s\S]*?permissions: user\.permissions,[\s\S]*?modules: product\.modules,/);
    expect(layout).toContain("<AppShell initialAccount={initialAccount}>");

    expect(shell).toContain("initialAccount?: AccountData | null");
    expect(shell).toContain("<AppShellDataProvider initialAccount={initialAccount}>");
    expect(provider).toContain("useState<AccountData | null>(initialAccount)");
    expect(provider).toContain("useState(initialAccount === null)");
  });

  it("keeps the compact Option-2 shell, solid active state, and truthful navigation", () => {
    const css = source("src/app/globals.css");
    const shell = source("src/components/layout/app-shell.tsx");
    const sidebar = source("src/components/layout/app-sidebar.tsx");
    const topNav = source("src/components/layout/desktop-top-nav.tsx");

    expect(css).toMatch(/\.app-sidebar-theme\s*\{[\s\S]*?--surface:\s*#[01][0-9a-f]{5}/i);
    expect(shell).toContain('collapsed ? "lg:grid-cols-[72px_1fr]" : "lg:grid-cols-[160px_1fr]"');
    expect(sidebar).toContain("app-sidebar-theme sidebar-scroll");
    expect(sidebar).toContain('aria-current={active ? "page" : undefined}');
    expect(sidebar).toContain('"bg-[var(--primary)] text-white');

    expect(sidebar).toMatch(
      /const visibleNavSections = navSections[\s\S]*?\.filter\(\(section\) => section\.items\.length > 0\)/,
    );
    expect(sidebar).toContain("{configurationSections.length > 0 ? (");

    expect(topNav).toContain("data-app-top-nav");
    expect(topNav).toContain("Semaine {isoWeekNumber(now)}");
    expect(topNav).toContain("<NotificationCenter showLabel />");
    expect(topNav).toContain("<UserAccountMenu />");
  });

  it("keeps one shared PageHeader contract with responsive actions", () => {
    const pageHeader = source("src/components/ui/page-header.tsx");

    expect(pageHeader).toContain("actions?: React.ReactNode");
    expect(pageHeader).toContain("<header");
    expect(pageHeader).toContain("<h1");
    expect(pageHeader).toContain('className="page-actions');

    for (const file of [
      "src/app/members/page.tsx",
      "src/app/payments/page.tsx",
      "src/app/sessions/page.tsx",
      "src/app/settings/page.tsx",
      "src/app/subscriptions/page.tsx",
    ]) {
      expect(source(file), file).toContain("<PageHeader");
    }

    for (const file of [
      "src/app/payments/page.tsx",
      "src/app/settings/page.tsx",
      "src/app/subscriptions/page.tsx",
    ]) {
      expect(source(file), file).toContain("actions={");
    }
  });

  it("keeps custom modal behavior on the accessible dialog primitive", () => {
    const dialogFiles = [
      "src/components/ui/confirm-dialog.tsx",
      "src/components/ui/list-controls.tsx",
      "src/components/ui/notice-dialog.tsx",
      "src/components/sessions/session-edit-modal.tsx",
      "src/components/sessions/session-planner-detail-sheet.tsx",
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

  it("keeps Planning compact, readable, responsive, and read-only aware", () => {
    const page = source("src/app/sessions/page.tsx");
    const planner = source("src/components/sessions/sessions-planner.tsx");
    const command = source("src/components/sessions/session-planner-command.tsx");
    const filters = source("src/components/sessions/session-planner-filters.tsx");
    const board = source("src/components/sessions/session-planner-board.tsx");
    const detailSheet = source("src/components/sessions/session-planner-detail-sheet.tsx");

    expect(page).toContain("readOnly={isDemoTenantSlug(authUser.tenantSlug)}");
    expect(planner).toContain("const canMutate = canManage && !readOnly");
    expect(planner.match(/if \(!canMutate\) return;/g)?.length ?? 0).toBeGreaterThanOrEqual(5);

    const composition = [
      "<PlanningCommandHeader",
      "<PlanningSummaryStrip",
      "<PlanningFiltersToolbar",
      "<PlanningWeekBoard",
      "<SessionPlannerDetailSheet",
    ].map((component) => planner.indexOf(component));
    expect(composition.every((index) => index >= 0)).toBe(true);
    expect(composition).toEqual([...composition].sort((left, right) => left - right));

    expect(command).toContain("export function PlanningSummaryStrip");
    expect(command).toContain('<SummaryChip label="cours"');
    expect(command).toContain("{readOnly ? (");

    expect(filters).toContain("list-toolbar sticky");
    expect(filters).toContain("lg:top-[var(--app-topbar-height)]");
    expect(filters).toContain("export function PlanningMobileFilterSheet");
    expect(filters).toContain("useAccessibleDialog");
    expect(filters).toContain('role="dialog"');

    expect(board).toContain("overflow-x-auto overscroll-x-contain");
    expect(board).toMatch(/gridTemplateColumns:.*minmax\([\d.]+rem, 1fr\)/);
    expect(board).toContain("minWidth:");
    expect(board).toContain('role="group"');
    expect(board).toContain("aria-pressed={active}");
    expect(board).not.toMatch(/role="tab(?:list|panel)?"/);
    expect(command).toContain("aria-pressed={viewMode === mode.value}");
    expect(command).not.toMatch(/role="tab(?:list|panel)?"/);

    expect(planner).toContain("const explicitSelectedSession = useMemo");
    expect(planner).toContain("const selectedSession = selectedSessionId ? explicitSelectedSession : recommendedSession");
    expect(planner).toMatch(/if \(!selectedSessionId \|\| explicitSelectedSession\) return;[\s\S]*?window\.setTimeout\([\s\S]*?setSelectedSessionId\(null\);[\s\S]*?setDetailOpen\(false\);/);

    expect(planner).toContain("min-[1440px]:grid-cols-[minmax(0,1fr)_21rem]");
    expect(planner).toContain("canManage={canMutate}");
    expect(planner).toContain("readOnly={readOnly}");
    expect(detailSheet).toContain('const WIDE_PLANNING_QUERY = "(min-width: 1440px)"');
    expect(detailSheet).toContain("useAccessibleDialog");
    expect(detailSheet).toContain('aria-modal="true"');
    expect(detailSheet).toContain("readOnly={readOnly}");
  });

  it("keeps Pointage as the Option-2 time queue with an adaptive inspector", () => {
    const page = source("src/app/attendance/today/page.tsx");
    const panel = source("src/components/attendance/check-in-panel.tsx");
    const queue = source("src/lib/attendance-queue.ts");
    const sessionCard = source("src/components/attendance/session-card.tsx");
    const inspector = source("src/components/attendance/check-in-drawer.tsx");
    const css = source("src/app/globals.css");

    expect(page).toContain("formatToParts(now)");
    expect(page).toContain("currentMinutes");
    expect(page).toContain("appTimeZone,");
    expect(page).toContain("readOnly: isDemoTenantSlug(authUser.tenantSlug)");

    expect(panel).toContain("const [tenantClock, setTenantClock] = useState<TenantClock>");
    expect(panel).toContain("deriveEffectiveAttendanceQueueState(session, tenantClock)");
    expect(panel).toContain("setTenantClock(tenantClockAt(new Date(), data.appTimeZone))");
    expect(panel.match(/data\.currentMinutes/g)?.length ?? 0).toBe(1);
    expect(panel).toContain("window.setInterval(updateTenantClock, 60_000)");
    expect(panel).toContain('document.addEventListener("visibilitychange", updateTenantClock)');
    expect(panel).toContain("const nowSessions =");
    expect(panel).toContain("const nextSessions =");
    expect(panel).toContain("const regularizeSessions =");
    expect(panel).toContain("const completedSessions =");
    expect(panel).toContain(">Maintenant</h2>");
    expect(panel).toContain(">Ensuite</h2>");
    expect(panel).toContain(">À régulariser</h2>");
    expect(panel.match(/if \(data\.readOnly\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(panel).toContain("readOnly={data.readOnly}");

    expect(queue).toContain('queueKind: AttendanceQueueKind | null');
    expect(queue).toContain('? "NEEDS_FINALIZATION"');
    expect(queue).toContain('? "REGULARIZE"');
    expect(queue).toContain("sessionDay < clock.dayIso");

    expect(queue).toContain('export type AttendanceQueueKind = "NOW" | "NEXT" | "REGULARIZE" | "DONE"');
    expect(sessionCard).toContain('export type { AttendanceQueueKind } from "@/lib/attendance-queue"');
    expect(sessionCard).toContain('id={`attendance-session-${session.id}`}');
    expect(sessionCard).toContain('kind === "NOW" && !readOnly && "attendance-session-action-primary"');

    expect(inspector).toContain('const DESKTOP_QUERY = "(min-width: 1180px)"');
    expect(inspector).toContain("useAccessibleDialog");
    expect(inspector).toContain('role={isDesktop ? "region" : "dialog"}');
    expect(inspector).toContain("disabled={readOnly || isFinalized || isUpcoming");
    expect(inspector).toContain("Mode démo");

    expect(css).toContain(".attendance-session-action-primary");
    expect(css).toMatch(/@media \(min-width: 1180px\)[\s\S]*?\.attendance-workbench[\s\S]*?grid-template-columns:/);
    expect(css).toMatch(/@media \(min-width: 1180px\)[\s\S]*?\.attendance-inspector-layer[\s\S]*?position: static/);
  });

  it("keeps tenant presentation, operational alerts, and payment escape controls explicit", () => {
    const sidebar = source("src/components/layout/app-sidebar.tsx");
    const login = source("src/app/login/page.tsx");
    const dashboard = source("src/app/page.tsx");
    const gymCheckIn = source("src/components/gym/gym-check-in-panel.tsx");
    const notifications = source("src/components/notifications/notification-center.tsx");
    const paymentForm = source("src/components/payments/payment-add-form.tsx");
    const paymentPage = source("src/app/payments/new/page.tsx");

    expect(sidebar).not.toContain("/we-discipline/navbar-logo.png");
    expect(login).not.toContain("/we-discipline/navbar-logo.png");
    expect(dashboard).not.toContain("/we-discipline/");
    expect(gymCheckIn).not.toMatch(/className="input(?:\s|")/);

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
    expect(memberList).toContain("lg:top-[var(--app-topbar-height)]");
    expect(memberCard).toContain("min-h-11");

    expect(enrollmentSummary).not.toContain("order-first");
    expect(enrollmentWizard).toContain("xl:grid-cols-[minmax(0,1fr)_22rem]");
    expect(enrollmentWizard).toContain("xl:top-[var(--app-sticky-offset)]");
    expect(enrollmentWizard.indexOf("<EnrollmentSummarySidebar")).toBeGreaterThan(
      enrollmentWizard.indexOf("{step === 1"),
    );
    expect(enrollmentLine).toContain('name={`${line.key}-mode`}');
  });
});
