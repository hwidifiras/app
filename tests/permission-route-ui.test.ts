import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("permission-aware page actions", () => {
  it("only offers member creation when the user can start an enrollment", () => {
    const membersPage = source("src/app/members/page.tsx");
    const memberList = source("src/components/members/member-list-client.tsx");

    expect(membersPage).toContain(
      'authUser.role === "ADMIN" || hasPermission(authUser.permissions, "enrollment.sell")',
    );
    expect(membersPage).toContain("canSellEnrollment={canSellEnrollment}");
    expect(memberList).toContain("canSellEnrollment: boolean");
    expect(memberList).toContain("{canSellEnrollment ? (");
    expect(memberList).toContain('href="/members/new"');
  });

  it("keeps new gym and mixed members inside their selected enrollment flow", () => {
    const enrollmentPage = source("src/app/enrollment/page.tsx");
    const subscriptionForm = source("src/components/subscriptions/subscription-add-form.tsx");

    expect(enrollmentPage).toContain(
      'href={`/enrollment?type=${selectedType}&memberMode=new#renew-member`}',
    );
    expect(enrollmentPage).toContain(
      'initialMemberMode={memberMode === "new" ? "NEW" : "EXISTING"}',
    );
    expect(subscriptionForm).toContain('initialMemberMode?: "EXISTING" | "NEW"');
    expect(subscriptionForm).toContain('initialMemberId ? "EXISTING" : initialMemberMode');
  });

  it("routes gym managers to history unless they can also perform check-ins", () => {
    const settingsPage = source("src/app/settings/page.tsx");

    expect(settingsPage).toContain(
      'authUser.role === "ADMIN" || hasPermission(authUser.permissions, "gym.checkin")',
    );
    expect(settingsPage).toContain('href={canCheckInGym ? "/gym/check-in" : "/gym/visits"}');
    expect(settingsPage).toContain('secondaryHref={canCheckInGym ? "/gym/visits" : undefined}');
  });

  it("hides every member group-assignment entry point without enrollment selling access", () => {
    const memberPage = source("src/app/members/[id]/page.tsx");
    const recoveryGuide = source("src/components/members/member-recovery-guide.tsx");
    const assignmentPage = source("src/app/members/[id]/add-to-group/page.tsx");

    expect(memberPage.match(/member\.status === "ACTIVE" && canSellEnrollment/g)).toHaveLength(3);
    expect(memberPage).toContain("canAssignClass={canSellEnrollment}");
    expect(recoveryGuide).toContain("...(canAssignClass");
    expect(recoveryGuide).toContain("`/members/${memberId}/add-to-group`");

    const permissionCheck = assignmentPage.indexOf(
      'hasPermission(authUser.permissions, "enrollment.sell")',
    );
    const memberLookup = assignmentPage.indexOf("const member = await prisma.member.findFirst");
    expect(permissionCheck).toBeGreaterThan(-1);
    expect(memberLookup).toBeGreaterThan(permissionCheck);
  });

  it("keeps financial correction mutations behind their dedicated API permissions", () => {
    const paymentsRoute = source("src/app/api/payments/route.ts");
    const subscriptionsRoute = source("src/app/api/member-subscriptions/route.ts");
    const pauseRoute = source("src/app/api/member-subscriptions/[id]/pause/route.ts");
    const resumeRoute = source("src/app/api/member-subscriptions/[id]/resume/route.ts");
    const replaceRoute = source("src/app/api/member-subscriptions/[id]/replace/route.ts");
    const adjustRoute = source(
      "src/app/api/member-subscriptions/[id]/entitlements/[entitlementId]/adjust/route.ts",
    );

    expect(paymentsRoute.match(/requirePermission\(request, "payments\.correct"\)/g)).toHaveLength(2);
    expect(paymentsRoute.match(/actor\.role !== "ADMIN"/g)).toHaveLength(2);
    expect(source("src/app/payments/[id]/edit/page.tsx")).toContain(
      'const canCorrectPayments = authUser.role === "ADMIN"',
    );
    expect(subscriptionsRoute.match(/requirePermission\(request, "subscriptions\.correct"\)/g)).toHaveLength(2);
    for (const route of [pauseRoute, resumeRoute, replaceRoute, adjustRoute]) {
      expect(route).toContain('requirePermission(request, "subscriptions.correct")');
    }
  });
});
