import { describe, expect, it, vi } from "vitest";
import * as paymentService from "@/modules/finance/payment-service";
import writeExcelFile from "write-excel-file/node";
import { readSheet } from "read-excel-file/node";
import { prisma } from "@/lib/prisma";
import { importDate, importMoney, importUnits, readImportRows } from "@/lib/excel-import-input";
import { previewStudentImport, applyStudentImport, type StudentImportOptions } from "@/lib/student-excel-import";
import { studentExcelTemplate } from "@/lib/student-excel-template";

const tenantId = "tenant_test", day = "2026-10-13";
let sequence = 0;
const suffix = () => `${Date.now()}-${++sequence}`;
async function fixtures(kind: "CLASS" | "GYM" | "MIXED", mode: "UNLIMITED" | "VISIT_QUOTA" = "UNLIMITED", firstUse = false) {
  const unique = suffix();
  await prisma.tenantModule.upsert({ where: { tenantId_moduleKey: { tenantId, moduleKey: "GYM_ACCESS" } }, create: { tenantId, moduleKey: "GYM_ACCESS", status: "ENABLED" }, update: { status: "ENABLED" } });
  const actor = await prisma.user.create({ data: { tenantId, email: `excel-${unique}@example.test`, name: "Excel Admin", passwordHash: "not-used", role: "ADMIN" } });
  const sport = await prisma.sport.create({ data: { tenantId, name: `Karate ${unique}` } });
  const coach = await prisma.coach.create({ data: { tenantId, firstName: "Test", lastName: "Coach", phone: `coach-${unique}` } });
  const group = await prisma.group.create({ data: { tenantId, name: `Cours ${unique}`, sportId: sport.id, coachId: coach.id, groupType: "MIXED", genderPolicy: "MIXED", capacity: 10 } });
  const plan = await prisma.subscriptionPlan.create({ data: { tenantId, name: `Formule ${unique}`, planKind: kind, price: 6000, totalSessions: kind === "GYM" ? 0 : 8, validityDays: 30, activationPolicy: firstUse ? "FIRST_USE" : "FIXED_DATE", activationWindowDays: 90, sportId: kind === "CLASS" ? sport.id : null, sessionsPerWeek: kind === "CLASS" ? 2 : null,
    entitlements: { create: [...(kind !== "GYM" ? [{ tenantId, type: "CLASS_SESSIONS" as const, sportId: sport.id, grantedUnits: 8, sessionsPerWeek: 2 }] : []), ...(kind !== "CLASS" ? [{ tenantId, type: "GYM_ACCESS" as const, gymAccessMode: mode, grantedUnits: mode === "VISIT_QUOTA" ? 10 : null }] : [])] } } });
  const options: StudentImportOptions = { kind, cutoverDate: day, defaultPlanId: plan.id, groupIds: kind === "GYM" ? [] : [group.id] };
  const phone = `0${String(Date.now()).slice(-8)}${sequence}`;
  const buffer = await writeExcelFile([["Prénom", "Nom", "Type membre", "Téléphone", "Séances restantes", "Visites restantes", "Montant total", "Déjà payé"], ["Élève", unique, "ADULT", phone, kind === "GYM" ? null : 3, mode === "VISIT_QUOTA" ? firstUse ? 10 : 4 : null, "60,00", "20,00"]]).toBuffer();
  return { actor, sport, group, plan, options, phone, input: { tenantId, actorId: actor.id, options, buffer, fileName: "eleves.xlsx" } };
}
describe("strict Excel values", () => {
  it("rejects overflowing calendar dates, partial numbers and fractional quotas", () => {
    expect(() => importDate("31/02/2026")).toThrow("impossible");
    expect(() => importDate("2026-13-01")).toThrow("impossible");
    expect(importDate("29/02/2024")?.toISOString()).toBe("2024-02-29T00:00:00.000Z");
    expect(() => importMoney("12oops", 0, "Payé")).toThrow();
    expect(() => importMoney("1.234", 0, "Payé")).toThrow();
    expect(importMoney("1 234,56", 0, "Payé")).toBe(123456);
    expect(() => importUnits("3.4", 8, "Quota")).toThrow();
    expect(() => importUnits("9", 8, "Quota")).toThrow();
  });
  it("reads a real xlsx and CSV decimal commas without losing leading phone zeros", async () => {
    const xlsx = await writeExcelFile([["Prénom", "Téléphone"], ["Amine", "00112233"]]).toBuffer();
    expect((await readImportRows(xlsx, "a.xlsx"))[1]).toEqual(["Amine", "00112233"]);
    expect((await readImportRows(Buffer.from('Prénom;Téléphone;Payé\n"Amine";00112233;12,34'), "a.csv"))[1]).toEqual(["Amine", "00112233", "12,34"]);
    await expect(readImportRows(Buffer.from("not-a-zip"), "a.xlsx")).rejects.toThrow();
  });
});
describe("transactional student import", () => {
  it.each(["CLASS", "GYM", "MIXED"] as const)("imports %s balances, groups, payments and a receipt once", async (kind) => {
    const data = await fixtures(kind, kind === "CLASS" ? "UNLIMITED" : "VISIT_QUOTA");
    const before = await prisma.member.count({ where: { tenantId } });
    const preview = await previewStudentImport(data.input);
    expect(preview.errorRows, JSON.stringify(preview.rows)).toBe(0);
    expect(await prisma.member.count({ where: { tenantId } })).toBe(before);
    const input = { ...data.input, previewToken: preview.previewToken! };
    const applied = await applyStudentImport(input);
    expect(applied.importedRows).toBe(1);
    const member = await prisma.member.findFirstOrThrow({ where: { tenantId, phone: data.phone }, include: { groups: true, subscriptions: { include: { entitlements: true, payments: { include: { receipt: true } } } } } });
    expect(member.groups).toHaveLength(kind === "GYM" ? 0 : 1);
    const subscription = member.subscriptions[0];
    expect(subscription.amount).toBe(6000);
    expect(subscription.payments[0].amount).toBe(2000);
    expect(subscription.payments[0].receipt?.status).toBe("ISSUED");
    if (kind !== "GYM") expect(subscription.entitlements.find((right) => right.type === "CLASS_SESSIONS")?.remainingUnits).toBe(3);
    if (kind !== "CLASS") expect(subscription.entitlements.find((right) => right.type === "GYM_ACCESS")?.remainingUnits).toBe(4);
    expect((await applyStudentImport(input)).importedRows).toBe(1);
    expect(await prisma.member.count({ where: { tenantId, phone: data.phone } })).toBe(1);
    const repeat = await previewStudentImport(data.input);
    expect(repeat.errorRows).toBe(1);
  });
  it("preserves first-use pending state, null end date and full quota", async () => {
    const data = await fixtures("GYM", "VISIT_QUOTA", true);
    const preview = await previewStudentImport(data.input);
    expect(preview.errorRows, JSON.stringify(preview.rows)).toBe(0);
    await applyStudentImport({ ...data.input, previewToken: preview.previewToken! });
    const sub = await prisma.memberSubscription.findFirstOrThrow({ where: { tenantId, planId: data.plan.id } });
    expect(sub.activatedAt).toBeNull(); expect(sub.endDate).toBeNull(); expect(sub.activationPolicy).toBe("FIRST_USE");
  });
  it("rejects changed files, choices, capacity and disabled modules after preview", async () => {
    const data = await fixtures("CLASS");
    const preview = await previewStudentImport(data.input);
    const input = { ...data.input, previewToken: preview.previewToken! };
    await expect(applyStudentImport({ ...input, buffer: Buffer.concat([input.buffer, Buffer.from("changed")]) })).rejects.toThrow("changé");
    await expect(applyStudentImport({ ...input, options: { ...input.options, cutoverDate: "2026-10-14" } })).rejects.toThrow("changé");
    await prisma.group.update({ where: { id: data.group.id }, data: { capacity: 0 } });
    await expect(applyStudentImport(input)).rejects.toThrow("changé");
    expect(await prisma.member.count({ where: { phone: data.phone } })).toBe(0);
    const gym = await fixtures("GYM");
    await prisma.tenantModule.update({ where: { tenantId_moduleKey: { tenantId, moduleKey: "GYM_ACCESS" } }, data: { status: "DISABLED" } });
    await expect(previewStudentImport(gym.input)).rejects.toThrow("pas actif");
  });
  it("refuses the entire batch when another row has an impossible date or overpayment", async () => {
    const data = await fixtures("GYM");
    const buffer = await writeExcelFile([["Prénom", "Nom", "Type membre", "Téléphone", "Date début", "Déjà payé"], ["Valid", "One", "ADULT", data.phone, day, 20], ["Invalid", "Two", "ADULT", `${data.phone}8`, "31/02/2026", 100]]).toBuffer();
    const preview = await previewStudentImport({ ...data.input, buffer });
    expect(preview).toMatchObject({ readyRows: 1, errorRows: 1, previewToken: null });
    expect(await prisma.member.count({ where: { phone: data.phone } })).toBe(0);
    await expect(applyStudentImport({ ...data.input, buffer, previewToken: "" })).rejects.toThrow();
  });
  it("rejects an administrator removed after preview", async () => {
    const data = await fixtures("GYM");
    const preview = await previewStudentImport(data.input);
    await expect(applyStudentImport({ ...data.input, actorId: "missing-actor", previewToken: preview.previewToken! })).rejects.toThrow();
    await prisma.user.delete({ where: { id: data.actor.id } });
    await expect(applyStudentImport({ ...data.input, previewToken: preview.previewToken! })).rejects.toThrow();
    expect(await prisma.member.count({ where: { phone: data.phone } })).toBe(0);
    expect(await prisma.memberSubscription.count({ where: { planId: data.plan.id } })).toBe(0);
  });
  it("rolls back every member and payment when the second receipt fails", async () => {
    const data = await fixtures("GYM");
    const buffer = await writeExcelFile([["Prénom", "Nom", "Type membre", "Téléphone", "Déjà payé"], ["First", "Student", "ADULT", data.phone, 20], ["Second", "Student", "ADULT", `${data.phone}1`, 20]]).toBuffer();
    const preview = await previewStudentImport({ ...data.input, buffer });
    expect(preview.readyRows, JSON.stringify(preview.rows)).toBe(2);
    const original = paymentService.recordSubscriptionPayment;
    let calls = 0;
    const spy = vi.spyOn(paymentService, "recordSubscriptionPayment").mockImplementation(async (...args) => { if (++calls === 2) throw new Error("Receipt write failure"); return original(...args); });
    try { await expect(applyStudentImport({ ...data.input, buffer, previewToken: preview.previewToken! })).rejects.toThrow("Receipt write failure"); }
    finally { spy.mockRestore(); }
    expect(calls).toBe(2);
    expect(await prisma.member.count({ where: { phone: { in: [data.phone, `${data.phone}1`] } } })).toBe(0);
    expect(await prisma.memberSubscription.count({ where: { planId: data.plan.id } })).toBe(0);
  });
  it("generates matching XLSX headers and a guide for the selected mixed variation", async () => {
    const data = await fixtures("MIXED", "VISIT_QUOTA");
    const buffer = await studentExcelTemplate(tenantId, data.options);
    const rows = await readSheet(buffer, 1);
    expect(rows[0]).toContain(`Restant ${data.sport.name}`);
    expect(rows[0]).toContain("Visites restantes");
    expect(rows[1]).toContain(data.plan.name);
    expect((await readSheet(buffer, 3))[0]).toEqual(["Champ", "Consigne"]);
  });
  it("imports siblings with a shared parent contact and no personal phone", async () => {
    const data = await fixtures("CLASS");
    const buffer = await writeExcelFile([["Prénom", "Nom", "Type membre", "Téléphone parent", "Nom parent", "Séances restantes"], ["أمين", "Family", "KID", data.phone, "Parent", 3], ["نور", "Family", "KID", data.phone, "Parent", 4]]).toBuffer();
    const preview = await previewStudentImport({ ...data.input, buffer });
    expect(preview.readyRows, JSON.stringify(preview.rows)).toBe(2);
    await applyStudentImport({ ...data.input, buffer, previewToken: preview.previewToken! });
    const children = await prisma.member.findMany({ where: { tenantId, parentPhone: data.phone } });
    expect(children).toHaveLength(2); expect(children.every((child) => child.phone === null && child.memberType === "KID")).toBe(true);
  });
  it("imports a mixed pack with independent balances for two disciplines", async () => {
    const data = await fixtures("MIXED", "VISIT_QUOTA");
    const sport = await prisma.sport.create({ data: { tenantId, name: `Judo ${suffix()}` } });
    const group = await prisma.group.create({ data: { tenantId, name: `Judo group ${suffix()}`, sportId: sport.id, coachId: data.group.coachId, groupType: "MIXED", genderPolicy: "MIXED", capacity: 10 } });
    await prisma.planEntitlement.create({ data: { tenantId, planId: data.plan.id, type: "CLASS_SESSIONS", sportId: sport.id, grantedUnits: 10, sessionsPerWeek: 2 } });
    const options = { ...data.options, groupIds: [data.group.id, group.id] };
    const buffer = await writeExcelFile([["Prénom", "Nom", "Type membre", "Téléphone", `Restant ${data.sport.name}`, `Restant ${sport.name}`, "Visites restantes"], ["Mixed", suffix(), "ADULT", data.phone, 3, 7, 4]]).toBuffer();
    const input = { ...data.input, buffer, options };
    const preview = await previewStudentImport(input);
    expect(preview.readyRows, JSON.stringify(preview.rows)).toBe(1);
    await applyStudentImport({ ...input, previewToken: preview.previewToken! });
    const rights = await prisma.subscriptionEntitlement.findMany({ where: { tenantId, memberSubscription: { planId: data.plan.id } } });
    expect(rights.find((right) => right.sportId === data.sport.id)?.remainingUnits).toBe(3);
    expect(rights.find((right) => right.sportId === sport.id)?.remainingUnits).toBe(7);
    expect(rights.find((right) => right.type === "GYM_ACCESS")?.remainingUnits).toBe(4);
  });
  it("restores an already activated first-use pass without reactivating it later", async () => {
    const data = await fixtures("GYM", "VISIT_QUOTA", true);
    const buffer = await writeExcelFile([["Prénom", "Nom", "Type membre", "Téléphone", "Date début", "Date fin", "Activation", "Visites restantes"], ["Active", suffix(), "ADULT", data.phone, "2026-10-01", "2026-10-31", "ACTIF", 4]]).toBuffer();
    const preview = await previewStudentImport({ ...data.input, buffer });
    expect(preview.readyRows, JSON.stringify(preview.rows)).toBe(1);
    await applyStudentImport({ ...data.input, buffer, previewToken: preview.previewToken! });
    const sub = await prisma.memberSubscription.findFirstOrThrow({ where: { tenantId, planId: data.plan.id } });
    expect(sub.activatedAt?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(sub.endDate?.toISOString()).toBe("2026-10-31T00:00:00.000Z");
  });
});
