import readXlsxFile from "read-excel-file/node";

import { prisma } from "@/lib/prisma";

type RawCell = string | number | boolean | Date | null | undefined;
type RawRow = RawCell[];

type HeaderKey = "firstName" | "lastName" | "phone" | "email" | "planName" | "startDate" | "paid";

const HEADER_ALIASES: Record<HeaderKey, string[]> = {
  firstName: ["prenom", "firstname"],
  lastName: ["nom", "lastname"],
  phone: ["telephone", "tel", "phone"],
  email: ["email", "mail"],
  planName: ["formule", "plan", "abonnement"],
  startDate: ["datedebut", "debut", "debutabonnement", "startdate"],
  paid: ["paye", "montantpaye", "avance", "paid"],
};

function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function text(value: RawCell) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").trim();
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if ((character === ";" || character === ",") && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells;
}

async function readRows(buffer: Buffer, fileName: string): Promise<RawRow[]> {
  if (fileName.toLowerCase().endsWith(".csv")) {
    return buffer.toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean).map(parseCsvLine);
  }
  return await readXlsxFile(buffer) as unknown as RawRow[];
}

function headerIndex(header: RawRow) {
  const cells = new Map(header.map((cell, index) => [normalized(cell), index]));
  const result = new Map<HeaderKey, number>();
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as Array<[HeaderKey, string[]]>) {
    const match = aliases.map(normalized).find((alias) => cells.has(alias));
    if (match) result.set(key, cells.get(match) as number);
  }
  return result;
}

function read(row: RawRow, index: Map<HeaderKey, number>, key: HeaderKey) {
  const column = index.get(key);
  return column === undefined ? "" : text(row[column]);
}

function parseMoneyCents(value: string) {
  if (!value.trim()) return 0;
  const amount = Number.parseFloat(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

function parseDate(value: string) {
  if (!value.trim()) return null;
  const french = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(value);
  const date = french
    ? new Date(Date.UTC(Number(french[3]), Number(french[2]) - 1, Number(french[1])))
    : new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function previewGymImport(input: { tenantId: string; buffer: Buffer; fileName: string }) {
  const rows = await readRows(input.buffer, input.fileName);
  if (rows.length < 2) throw new Error("GYM_IMPORT_EMPTY");
  const index = headerIndex(rows[0]);
  const required: HeaderKey[] = ["firstName", "lastName", "phone", "planName"];
  const missing = required.filter((key) => !index.has(key));
  if (missing.length > 0) throw new Error(`GYM_IMPORT_MISSING_HEADERS:${missing.join(",")}`);

  const [plans, existingMembers] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where: {
        tenantId: input.tenantId,
        isActive: true,
        planKind: { in: ["GYM", "MIXED"] },
        entitlements: { some: { type: "GYM_ACCESS" } },
      },
      select: { id: true, name: true, price: true, activationPolicy: true },
    }),
    prisma.member.findMany({
      where: { tenantId: input.tenantId },
      select: { id: true, phone: true, firstName: true, lastName: true, status: true },
    }),
  ]);
  const plansByName = new Map<string, typeof plans>();
  for (const plan of plans) plansByName.set(normalized(plan.name), [...(plansByName.get(normalized(plan.name)) ?? []), plan]);
  const membersByPhone = new Map(existingMembers.map((member) => [member.phone.trim(), member]));
  const seenPhones = new Set<string>();
  const resultRows = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (row.every((cell) => !text(cell))) continue;
    const firstName = read(row, index, "firstName");
    const lastName = read(row, index, "lastName");
    const phone = read(row, index, "phone");
    const email = read(row, index, "email");
    const planName = read(row, index, "planName");
    const paid = parseMoneyCents(read(row, index, "paid"));
    const rawStartDate = read(row, index, "startDate");
    const startDate = parseDate(rawStartDate);
    const planMatches = plansByName.get(normalized(planName)) ?? [];
    const existing = membersByPhone.get(phone);
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!firstName) errors.push("Prénom requis");
    if (!lastName) errors.push("Nom requis");
    if (phone.length < 6) errors.push("Téléphone invalide");
    if (seenPhones.has(phone)) errors.push("Téléphone répété dans le fichier");
    if (planMatches.length === 0) errors.push(`Formule salle introuvable : ${planName || "vide"}`);
    if (planMatches.length > 1) errors.push(`Nom de formule ambigu : ${planName}`);
    if (paid === null) errors.push("Montant payé invalide");
    if (planMatches[0] && paid !== null && paid > planMatches[0].price) errors.push("Montant payé supérieur au prix de la formule");
    if (rawStartDate && !startDate) errors.push("Date de début invalide");
    if (existing?.status !== undefined && existing.status !== "ACTIVE") errors.push("Le téléphone appartient à un membre résilié");
    if (existing && normalized(`${existing.firstName}${existing.lastName}`) !== normalized(`${firstName}${lastName}`)) {
      warnings.push(`Téléphone déjà rattaché à ${existing.firstName} ${existing.lastName}`);
    }
    if (planMatches[0]?.activationPolicy === "FIRST_USE" && startDate) {
      warnings.push("Cette formule s'activera à la première entrée ; la date fournie sert uniquement de date de vente.");
    }
    seenPhones.add(phone);
    resultRows.push({
      rowNumber: rowIndex + 1,
      firstName,
      lastName,
      phone,
      email,
      planName,
      planId: planMatches[0]?.id ?? null,
      paidCents: paid,
      startDate: startDate?.toISOString() ?? null,
      memberAction: existing ? "EXISTING" : "CREATE",
      existingMemberId: existing?.id ?? null,
      status: errors.length === 0 ? "READY" : "ERROR",
      errors,
      warnings,
    });
  }

  return {
    totalRows: resultRows.length,
    readyRows: resultRows.filter((row) => row.status === "READY").length,
    errorRows: resultRows.filter((row) => row.status === "ERROR").length,
    rows: resultRows,
    dryRun: true,
  };
}
