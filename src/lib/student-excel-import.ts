import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/serializable-transaction";
import { checkGroupMemberCompatibility } from "@/lib/demographics";
import { resolveMemberPhone } from "@/lib/member-phone";
import { buildSubscriptionData } from "@/lib/subscription-service";
import { computeEndDate } from "@/lib/membership-rules";
import { createSubscriptionEntitlementSnapshots } from "@/lib/subscription-entitlements";
import { recordAnnualInsuranceCoverage } from "@/lib/annual-insurance";
import { recordSubscriptionPayment } from "@/modules/finance/payment-service";
import { importDate, importMoney, importText, importUnits, normalizeImportText as normalize, readImportRows, type ImportRows } from "@/lib/excel-import-input";

export const studentImportOptions = z.object({
  kind: z.enum(["CLASS", "GYM", "MIXED"]),
  cutoverDate: z.string().length(10),
  defaultPlanId: z.string().max(100).default(""),
  groupIds: z.array(z.string().max(100)).max(12).default([]),
});
export type StudentImportOptions = z.infer<typeof studentImportOptions>;
type Db = Prisma.TransactionClient;
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const headers = {
  firstName: ["Prénom", "firstName"], lastName: ["Nom", "lastName"], phone: ["Téléphone", "phone"],
  memberType: ["Type membre", "Type", "memberType"], gender: ["Genre", "gender"], birthDate: ["Date naissance", "birthDate"],
  parentName: ["Nom parent", "parentName"], parentPhone: ["Téléphone parent", "parentPhone"], email: ["Email"], address: ["Adresse", "address"],
  plan: ["Formule", "Plan", "planName"], groups: ["Groupes", "Groupe", "groupName"], start: ["Date début", "startDate"], end: ["Date fin", "endDate"],
  paid: ["Déjà payé", "Montant payé", "paid"], amount: ["Montant total", "Montant à suivre", "amount"],
  remaining: ["Séances restantes", "remainingSessions"], gymRemaining: ["Visites restantes", "remainingVisits"], activation: ["Activation", "État activation"],
  insurance: ["Assurance payée", "insuranceFee"], insuranceStart: ["Date assurance", "insuranceStart"],
};

export async function studentImportCatalog(tenantId: string, db: Db = prisma) {
  const [plans, groups, modules, members] = await Promise.all([
    db.subscriptionPlan.findMany({ where: { tenantId, isActive: true }, include: { entitlements: { include: { sport: { select: { name: true } } }, orderBy: { sortOrder: "asc" } }, sport: { select: { name: true } } }, orderBy: { name: "asc" } }),
    db.group.findMany({ where: { tenantId, isActive: true }, include: { sport: { select: { name: true } }, _count: { select: { members: { where: { tenantId, status: "ACTIVE" } } } } }, orderBy: { name: "asc" } }),
    db.tenantModule.findMany({ where: { tenantId, status: "ENABLED" }, select: { moduleKey: true } }),
    db.member.findMany({ where: { tenantId }, select: { phone: true, firstName: true, lastName: true, parentPhone: true, birthDate: true } }),
  ]);
  return { plans, groups, modules: modules.map((item) => item.moduleKey).sort(), members };
}
type Catalog = Awaited<ReturnType<typeof studentImportCatalog>>;
const configHash = (catalog: Catalog) => hash(JSON.stringify({ plans: catalog.plans, groups: catalog.groups, modules: catalog.modules }));
function allowed(kind: StudentImportOptions["kind"], catalog: Catalog) {
  if (kind !== "GYM" && !catalog.modules.includes("CLASS_MANAGEMENT")) throw new Error("Le module arts martiaux n'est pas actif pour ce club.");
  if (kind !== "CLASS" && !catalog.modules.includes("GYM_ACCESS")) throw new Error("Le module salle n'est pas actif pour ce club.");
}
function phone(value: string, label: string) {
  if (!value) return "";
  if (!/^\+?[\d ()-]+$/.test(value) || value.replace(/\D/g, "").length < 6 || value.replace(/\D/g, "").length > 15) throw new Error(`${label} invalide. Conservez les numéros au format texte dans Excel.`);
  return value.replace(/[ ()-]/g, "");
}
function mapChoice<T extends string>(value: string, mapping: Record<string, T>, label: string): T {
  const choice = mapping[normalize(value)];
  if (!choice) throw new Error(`${label} invalide : ${value || "vide"}.`);
  return choice;
}
function prepare(rows: ImportRows, options: StudentImportOptions, catalog: Catalog) {
  allowed(options.kind, catalog);
  const cutover = importDate(options.cutoverDate, "Date de reprise");
  if (!cutover) throw new Error("Date de reprise requise.");
  const columns = rows[0].map((cell) => normalize(importText(cell)));
  const populated = columns.filter(Boolean);
  if (new Set(populated).size !== populated.length) throw new Error("Deux colonnes portent le même nom.");
  const index = Object.fromEntries(Object.entries(headers).map(([key, aliases]) => [key, columns.findIndex((column) => aliases.some((alias) => normalize(alias) === column))])) as Record<keyof typeof headers, number>;
  for (const key of ["firstName", "lastName", "memberType"] as const) if (index[key] < 0) throw new Error(`Colonne requise : ${headers[key][0]}.`);
  if (index.plan < 0 && !options.defaultPlanId) throw new Error("Choisissez une formule ou ajoutez la colonne Formule.");
  const seenPhones = new Set<string>(), seenIdentities = new Set<string>(), groupQueue = new Map<string, number>();
  const prepared = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((cell) => cell === null || cell === undefined || cell === "")) continue;
    const read = (key: keyof typeof headers) => index[key] < 0 ? "" : importText(row[index[key]]);
    const errors: string[] = [], warnings: string[] = [];
    let value;
    let firstName = "", lastName = "", planName = "";
    try {
      firstName = read("firstName"); lastName = read("lastName"); planName = read("plan");
      if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100) throw new Error("Prénom et nom requis (100 caractères maximum chacun).");
      const memberType = mapChoice(read("memberType"), { adulte: "ADULT", adult: "ADULT", enfant: "KID", kid: "KID", nonspecifie: "NOT_SPECIFIED", nonprecise: "NOT_SPECIFIED", notspecified: "NOT_SPECIFIED" }, "Type membre");
      const gender = read("gender") ? mapChoice(read("gender"), { homme: "MALE", garcon: "MALE", male: "MALE", femme: "FEMALE", fille: "FEMALE", female: "FEMALE", nonprecise: "NOT_SPECIFIED", notspecified: "NOT_SPECIFIED" }, "Genre") : "NOT_SPECIFIED" as const;
      const directPhone = phone(read("phone"), "Téléphone"), parentPhone = phone(read("parentPhone"), "Téléphone parent");
      const memberPhone = resolveMemberPhone({ firstName, lastName, memberType, phone: directPhone, parentPhone });
      if (memberPhone && (seenPhones.has(memberPhone.replace(/\D/g, "")) || catalog.members.some((member) => member.phone?.replace(/\D/g, "") === memberPhone.replace(/\D/g, "")))) throw new Error("Téléphone déjà présent dans le club ou dans ce fichier. Aucun membre existant ne sera écrasé.");
      if (memberPhone) seenPhones.add(memberPhone.replace(/\D/g, ""));
      const birthDate = importDate(read("birthDate"), "Date de naissance");
      if (birthDate && birthDate > cutover) throw new Error("La date de naissance est après la reprise.");
      const identity = `${normalize(firstName)}|${normalize(lastName)}|${(memberPhone ?? parentPhone).replace(/\D/g, "")}|${birthDate?.toISOString() ?? ""}`;
      if (seenIdentities.has(identity) || catalog.members.some((member) => `${normalize(member.firstName)}|${normalize(member.lastName)}|${(member.phone ?? member.parentPhone ?? "").replace(/\D/g, "")}|${member.birthDate?.toISOString() ?? ""}` === identity)) throw new Error("Cet élève existe déjà dans le club ou le fichier.");
      seenIdentities.add(identity);
      const email = read("email");
      if (email && !z.email().safeParse(email).success) throw new Error("Email invalide.");
      const matches = catalog.plans.filter((plan) => planName ? normalize(plan.name) === normalize(planName) : plan.id === options.defaultPlanId);
      if (matches.length !== 1 || matches[0].planKind !== options.kind) throw new Error("Formule absente, ambiguë ou incompatible avec le type d'import sélectionné.");
      const plan = matches[0]; planName = plan.name;
      const classRights = plan.entitlements.filter((right) => right.type === "CLASS_SESSIONS");
      const gymRights = plan.entitlements.filter((right) => right.type === "GYM_ACCESS");
      if (options.kind !== "GYM" && !classRights.length && !plan.sportId) throw new Error("Formule sans discipline.");
      if (options.kind !== "CLASS" && gymRights.length !== 1) throw new Error("Formule sans accès salle unique.");
      const sportIds = classRights.length ? classRights.map((right) => right.sportId) : options.kind === "CLASS" ? [plan.sportId] : [];
      const rawGroups = read("groups");
      const selectedGroups = rawGroups ? rawGroups.split("|").map((name) => {
        const matches = catalog.groups.filter((group) => normalize(group.name) === normalize(name));
        if (matches.length !== 1) throw new Error(`Groupe absent ou ambigu : ${name}.`);
        return matches[0];
      }) : options.groupIds.map((id) => {
        const group = catalog.groups.find((group) => group.id === id);
        if (!group) throw new Error("Groupe par défaut indisponible.");
        return group;
      });
      if (new Set(selectedGroups.map((group) => group.id)).size !== selectedGroups.length || selectedGroups.length !== sportIds.length || sportIds.some((sportId) => selectedGroups.filter((group) => group.sportId === sportId).length !== 1)) throw new Error("Choisissez exactement un groupe pour chaque discipline de la formule ; aucun groupe pour une formule salle seule.");
      for (const group of selectedGroups) {
        if (!checkGroupMemberCompatibility({ groupType: group.groupType, genderPolicy: group.genderPolicy, memberType, gender }).ok) throw new Error(`Type ou genre incompatible avec ${group.name}.`);
        if (group._count.members + (groupQueue.get(group.id) ?? 0) >= group.capacity) throw new Error(`Capacité atteinte pour ${group.name}.`);
      }
      const start = importDate(read("start") || options.cutoverDate, "Date début")!;
      if (start > cutover) throw new Error("La date début doit être au plus tard la date de reprise.");
      const pending = plan.activationPolicy === "FIRST_USE" && (!read("activation") || ["attente", "pending"].includes(normalize(read("activation"))));
      const activation = read("activation");
      if (activation && !["actif", "active", "attente", "pending"].includes(normalize(activation))) throw new Error("Activation : ACTIF ou ATTENTE.");
      if (plan.activationPolicy !== "FIRST_USE" && ["attente", "pending"].includes(normalize(activation))) throw new Error("ATTENTE est réservée aux formules à première entrée.");
      if (plan.activationPolicy === "FIRST_USE" && plan.planKind !== "GYM") throw new Error("La première entrée est réservée aux formules salle.");
      const explicitEnd = importDate(read("end"), "Date fin");
      if (pending && explicitEnd) throw new Error("Pas de date fin pour un pass en attente de première entrée.");
      if (plan.activationPolicy === "FIRST_USE" && !pending && !explicitEnd) throw new Error("Date fin requise pour reprendre un pass déjà activé à première entrée.");
      const end = pending ? null : explicitEnd ?? computeEndDate(start, plan.validityDays);
      if (end && (end < start || end < cutover)) throw new Error("Date fin antérieure à la reprise ou au début.");
      if (pending && computeEndDate(start, plan.activationWindowDays) < cutover) throw new Error("Le délai de première activation est déjà expiré.");
      const amount = importMoney(read("amount"), plan.price, "Montant total"), paid = importMoney(read("paid"), 0, "Déjà payé");
      const insurance = importMoney(read("insurance"), 0, "Assurance payée"), insuranceStart = importDate(read("insuranceStart"), "Date assurance");
      if (paid > amount || insurance > amount || insurance > paid) throw new Error("Le payé ne doit pas dépasser le total ; l'assurance doit être comprise dans le total déjà payé.");
      if (Boolean(insurance) !== Boolean(insuranceStart) || (insuranceStart && insuranceStart > cutover)) throw new Error("Assurance payée et date assurance doivent être renseignées ensemble, au plus tard à la reprise.");
      const balances = [];
      for (const right of classRights.length ? classRights : plan.planKind === "CLASS" ? [{ id: null, sportId: plan.sportId, grantedUnits: plan.totalSessions, sport: plan.sport }] : []) {
        const sportLabel = right.sport?.name ?? right.sportId ?? "";
        const column = columns.indexOf(normalize(`Restant ${sportLabel}`));
        const raw = column >= 0 ? importText(row[column]) : sportIds.length === 1 ? read("remaining") : "";
        balances.push({ id: right.id, sportId: right.sportId!, remaining: importUnits(raw, right.grantedUnits ?? plan.totalSessions, `Séances restantes ${sportLabel}`) });
      }
      let gymRemaining: number | null = null;
      const gym = gymRights[0];
      if (gym?.gymAccessMode === "VISIT_QUOTA") {
        if (gym.grantedUnits === null) throw new Error("Quota de la formule invalide.");
        gymRemaining = importUnits(read("gymRemaining"), gym.grantedUnits, "Visites restantes");
        if (pending && gymRemaining !== gym.grantedUnits) throw new Error("Un pass en attente doit conserver son quota complet.");
      } else if (read("gymRemaining")) throw new Error("Une formule illimitée ou sans salle ne doit pas avoir de quota de visites.");
      if (sportIds.length === 0 && read("remaining")) throw new Error("Une formule salle ne doit pas avoir de séances de cours.");
      for (const group of selectedGroups) groupQueue.set(group.id, (groupQueue.get(group.id) ?? 0) + 1);
      warnings.push("Reprise historique : le montant total inclut toute assurance saisie. Aucun supplément automatique.");
      value = { firstName, lastName, phone: memberPhone, parentPhone: parentPhone || null, parentName: read("parentName") || null, memberType, gender, birthDate, email: email || null, address: read("address") || null, plan, groups: selectedGroups, start, end, pending, amount, paid, insurance, insuranceStart, balances, gymRemaining };
    } catch (error) { errors.push(error instanceof Error ? error.message : "Ligne invalide."); }
    prepared.push({ rowNumber: i + 1, firstName, lastName, planName, errors, warnings, value });
  }
  return prepared;
}
type Prepared = ReturnType<typeof prepare>;
function summary(prepared: Prepared) {
  return { totalRows: prepared.length, readyRows: prepared.filter((row) => !row.errors.length).length, errorRows: prepared.filter((row) => row.errors.length).length, rows: prepared.map(({ value, ...row }) => ({ ...row, amountCents: value?.amount ?? null, paidCents: value?.paid ?? null, balanceCents: value ? value.amount - value.paid : null, groupNames: value?.groups.map((group) => group.name) ?? [], activation: value?.pending ? "ATTENTE" : "ACTIF", activationPolicy: value?.plan.activationPolicy ?? null, startDate: value?.start.toISOString().slice(0, 10) ?? null, endDate: value?.end?.toISOString().slice(0, 10) ?? null, classBalances: value?.balances.map((balance) => ({ sportId: balance.sportId, sportName: value.plan.entitlements.find((right) => right.sportId === balance.sportId)?.sport?.name ?? value.plan.sport?.name ?? "Cours", remaining: balance.remaining })) ?? [], gymMode: value?.plan.entitlements.find((right) => right.type === "GYM_ACCESS")?.gymAccessMode ?? null, gymRemaining: value?.gymRemaining ?? null })) };
}
type Ticket = { version: 1; actorId: string; tenantId: string; inputHash: string; configHash: string; expires: number; key: string };
function sign(value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error("Clé locale indisponible.");
  return createHmac("sha256", secret).update(value).digest("base64url");
}
function ticketRead(value: string): Ticket {
  if (value.length > 4000) throw new Error("Prévisualisation invalide.");
  const [content, signature, extra] = value.split(".");
  if (!content || !signature || extra) throw new Error("Prévisualisation requise.");
  const actual = Buffer.from(signature), expected = Buffer.from(sign(content));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Prévisualisation invalide.");
  return JSON.parse(Buffer.from(content, "base64url").toString("utf8")) as Ticket;
}
type Input = { buffer: Buffer; fileName: string; options: StudentImportOptions; tenantId: string; actorId: string };
const inputHash = (input: Input) => hash(`${hash(input.buffer)}|${/\.csv$/i.test(input.fileName) ? "csv" : "xlsx"}|${JSON.stringify(input.options)}`);
export async function previewStudentImport(input: Input) {
  const options = studentImportOptions.parse(input.options);
  const catalog = await studentImportCatalog(input.tenantId);
  const prepared = prepare(await readImportRows(input.buffer, input.fileName), options, catalog);
  const result = summary(prepared);
  const ticket: Ticket = { version: 1, actorId: input.actorId, tenantId: input.tenantId, inputHash: inputHash({ ...input, options }), configHash: configHash(catalog), expires: Date.now() + 15 * 60_000, key: randomUUID() };
  const content = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  return { ...result, previewToken: result.errorRows || !result.readyRows ? null : `${content}.${sign(content)}`, importedRows: 0 };
}

export async function applyStudentImport(input: Input & { previewToken: string }) {
  const options = studentImportOptions.parse(input.options), ticket = ticketRead(input.previewToken), requestHash = inputHash({ ...input, options });
  if (ticket.version !== 1 || ticket.actorId !== input.actorId || ticket.tenantId !== input.tenantId || ticket.inputHash !== requestHash) throw new Error("Le fichier ou les choix ont changé. Vérifiez à nouveau.");
  const rows = await readImportRows(input.buffer, input.fileName);
  return runSerializableTransaction(async (tx) => {
    const actor = await tx.user.findFirst({ where: { tenantId: input.tenantId, id: input.actorId, isActive: true, role: "ADMIN" }, select: { id: true } });
    if (!actor) throw new Error("Administrateur actif requis. Aucun élève importé.");
    const existing = await tx.idempotencyRecord.findUnique({ where: { tenantId_scope_key: { tenantId: input.tenantId, scope: "student-excel-import", key: ticket.key } } });
    if (existing) { if (existing.requestHash !== requestHash) throw new Error("Import incompatible."); return JSON.parse(existing.responseBody) as ReturnType<typeof summary> & { importedRows: number; replayed?: boolean }; }
    if (ticket.expires < Date.now()) throw new Error("Prévisualisation expirée. Vérifiez à nouveau.");
    const catalog = await studentImportCatalog(input.tenantId, tx);
    if (configHash(catalog) !== ticket.configHash) throw new Error("Les formules, groupes ou modules ont changé. Vérifiez à nouveau.");
    const prepared = prepare(rows, options, catalog), result = summary(prepared);
    if (result.errorRows || !result.readyRows) throw new Error("Le fichier n'est plus valide. Vérifiez à nouveau. Aucun élève importé.");
    for (const row of prepared) {
      const value = row.value!;
      const member = await tx.member.create({ data: { tenantId: input.tenantId, firstName: value.firstName, lastName: value.lastName, phone: value.phone, parentPhone: value.parentPhone, parentName: value.parentName, email: value.email, memberType: value.memberType, gender: value.gender, birthDate: value.birthDate, address: value.address, joinedAt: value.start } });
      const subscription = await tx.memberSubscription.create({ data: { ...buildSubscriptionData({ tenantId: input.tenantId, memberId: member.id, plan: value.plan, startDate: value.start, amountCents: value.amount, insuranceFeeCents: value.insurance, insuranceYear: value.insuranceStart?.getUTCFullYear() ?? null, insuranceCoverageDate: value.insuranceStart }), endDate: value.end, activatedAt: value.pending ? null : value.start, remainingSessions: value.plan.planKind === "CLASS" ? value.balances[0]?.remaining ?? 0 : 0 } });
      await recordAnnualInsuranceCoverage(tx, { tenantId: input.tenantId, memberId: member.id, subscriptionId: subscription.id, coverageStart: value.insuranceStart, amountCents: value.insurance });
      const rights = await createSubscriptionEntitlementSnapshots(tx, { tenantId: input.tenantId, memberSubscriptionId: subscription.id, planId: value.plan.id, startDate: value.start, endDate: value.end, legacyRemainingSessions: subscription.remainingSessions });
      for (const right of rights) {
        const remaining = right.type === "CLASS_SESSIONS" ? value.balances.find((balance) => balance.sportId === right.sportId)?.remaining : value.gymRemaining;
        await tx.subscriptionEntitlement.update({ where: { id: right.id, tenantId: input.tenantId }, data: { remainingUnits: remaining ?? null } });
      }
      for (const group of value.groups) await tx.groupMember.create({ data: { tenantId: input.tenantId, memberId: member.id, groupId: group.id, startDate: value.start, status: "ACTIVE" } });
      if (value.paid > 0) await recordSubscriptionPayment(tx, { tenantId: input.tenantId, memberSubscriptionId: subscription.id, amount: value.paid, actorId: input.actorId, source: "student-excel-import", paymentDate: importDate(options.cutoverDate)!, paymentMethod: "REPRISE_EXCEL", notes: `Reprise historique Excel — ligne ${row.rowNumber}` });
      await tx.auditLog.create({ data: { tenantId: input.tenantId, userId: input.actorId, action: "STUDENT_EXCEL_IMPORTED", entityType: "Member", entityId: member.id, details: JSON.stringify({ batchId: ticket.key, rowNumber: row.rowNumber, subscriptionId: subscription.id, planKind: options.kind }) } });
    }
    const response = { ...result, importedRows: result.readyRows };
    await tx.idempotencyRecord.create({ data: { tenantId: input.tenantId, scope: "student-excel-import", key: ticket.key, requestHash, responseStatus: 201, responseBody: JSON.stringify(response), expiresAt: new Date(Date.now() + 3650 * 86400_000) } });
    return response;
  }, { timeoutMs: 120_000 });
}
