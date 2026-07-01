import readXlsxFile from "read-excel-file/node";

import { applyDataImport, dataImportErrorMessage, inspectDataImport } from "@/lib/data-import-service";
import { resolveMemberPhone } from "@/lib/member-phone";
import { prisma } from "@/lib/prisma";
import { dataImportPayloadSchema, type DataImportPayload } from "@/lib/schemas/data-import";

type LookupRecord = {
  id: string;
  name: string;
  sportId: string;
  price?: number;
  totalSessions?: number;
  validityDays?: number;
};

export type BulkImportRowResult = {
  rowNumber: number;
  externalId: string;
  memberName: string;
  groupName: string;
  planName: string;
  status: "OK" | "ERROR" | "IMPORTED";
  errors: string[];
  warnings: string[];
  memberId?: string;
  remainingBalanceCents?: number;
};

export type BulkImportResult = {
  totalRows: number;
  okRows: number;
  errorRows: number;
  importedRows: number;
  rows: BulkImportRowResult[];
};

type PreparedRow = {
  result: BulkImportRowResult;
  payload?: DataImportPayload;
};

type RawCell = string | number | boolean | Date | null | undefined;
type RawRow = RawCell[];
type ReadWorkbookRows = (input: Buffer) => Promise<unknown>;
type WorkbookSheetResult = { sheet?: string; name?: string; data?: RawRow[] };

type HeaderKey =
  | "externalId"
  | "firstName"
  | "lastName"
  | "memberType"
  | "phone"
  | "email"
  | "birthDate"
  | "address"
  | "parentName"
  | "parentPhone"
  | "joinedAt"
  | "groupName"
  | "planName"
  | "assignmentStartDate"
  | "subscriptionStartDate"
  | "subscriptionEndDate"
  | "amount"
  | "paid"
  | "remainingSessions"
  | "paymentDate"
  | "paymentMethod"
  | "note";

const HEADER_ALIASES: Record<HeaderKey, string[]> = {
  externalId: [
    "externalid",
    "idexterne",
    "reference",
    "referenceauto",
    "referenceautomatique",
    "referenceautooptionnel",
    "referenceoptionnelle",
    "codeauto",
    "codeautofacultatif",
    "codeautomembre",
    "idauto",
    "identifiantauto",
    "codemembre",
    "codemembreauto",
    "codemembreautofacultatif",
    "codemembrelaisservide",
    "codemembreoptionnel",
    "codemembreautooptionnel",
    "codeadherent",
    "ref",
    "code",
    "matricule",
  ],
  firstName: ["firstname", "prenom"],
  lastName: ["lastname", "nom"],
  memberType: ["membertype", "type", "typemembre", "typeadherent"],
  phone: ["phone", "telephone", "tel"],
  email: ["email", "mail"],
  birthDate: ["birthdate", "datenaissance", "naissance"],
  address: ["address", "adresse"],
  parentName: ["parentname", "nomparent", "responsable"],
  parentPhone: ["parentphone", "telephoneparent", "telparent"],
  joinedAt: ["joinedat", "dateinscription", "inscritdepuis"],
  groupName: ["groupname", "groupe", "cours"],
  planName: ["planname", "formule", "plan", "abonnement"],
  assignmentStartDate: ["assignmentstartdate", "dateaffectation", "debutgroupe"],
  subscriptionStartDate: ["subscriptionstartdate", "debutabonnement"],
  subscriptionEndDate: ["subscriptionenddate", "finabonnement"],
  amount: ["amount", "montant", "montanttotal", "montantabonnement", "montantdu", "prix", "total"],
  paid: ["paid", "paye", "dejapaye"],
  remainingSessions: ["remainingsessions", "seancesrestantes", "reste"],
  paymentDate: ["paymentdate", "datepaiement", "datereglement"],
  paymentMethod: ["paymentmethod", "moyenpaiement", "modepaiement"],
  note: ["note", "notereprise", "commentaire", "remarque"],
};

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeLookup(value: string) {
  return normalizeHeader(value).trim();
}

function generateExternalId(
  sequenceNumber: number,
  firstName: string,
  lastName: string,
  phone: string,
  parentPhone: string,
) {
  const rowReference = `M${String(Math.max(sequenceNumber, 1)).padStart(3, "0")}`;
  const nameReference = normalizeLookup(`${firstName}${lastName}`).slice(0, 18);
  const phoneReference = normalizeLookup(phone || parentPhone).slice(-4);
  return [rowReference, nameReference, phoneReference].filter(Boolean).join("-");
}

function isGeneratedExternalId(value: string) {
  const normalized = normalizeLookup(value);
  return /^m\d{3}[a-z0-9]*$/.test(normalized);
}

function cellValueText(value: RawCell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())).toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + value * 24 * 60 * 60 * 1000);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
  }

  const text = String(value ?? "").trim();
  if (!text) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))).toISOString();
  }

  const fr = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  if (fr) {
    return new Date(Date.UTC(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1]))).toISOString();
  }

  const parsed = new Date(text);
  if (Number.isFinite(parsed.getTime())) {
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())).toISOString();
  }

  return null;
}

function addDaysIso(dateIso: string, days: number) {
  const date = new Date(dateIso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function parseMoneyCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100);
  const text = String(value ?? "").replace(/\s/g, "").replace(",", ".").trim();
  if (!text) return null;
  const amount = Number.parseFloat(text);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function parseInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMemberType(value: string): "ADULT" | "KID" | "NOT_SPECIFIED" | null {
  const normalized = normalizeLookup(value);
  if (!normalized) return null;
  if (["adult", "adulte", "adults"].includes(normalized)) return "ADULT";
  if (["kid", "kids", "enfant", "enfants"].includes(normalized)) return "KID";
  if (["notspecified", "nonprecise"].includes(normalized)) return "NOT_SPECIFIED";
  return null;
}

function buildHeaderIndex(row: RawRow) {
  const normalizedCells = new Map<string, number>();
  row.forEach((cell, index) => {
    const normalized = normalizeHeader(cellValueText(cell));
    if (normalized) normalizedCells.set(normalized, index);
  });

  const result = new Map<HeaderKey, number>();
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as Array<[HeaderKey, string[]]>) {
    for (const alias of aliases) {
      const col = normalizedCells.get(normalizeHeader(alias));
      if (col !== undefined) {
        result.set(key, col);
        break;
      }
    }
  }
  return result;
}

function readCell(row: RawRow, headerIndex: Map<HeaderKey, number>, key: HeaderKey): unknown {
  const col = headerIndex.get(key);
  if (col === undefined) return "";
  return row[col];
}

function readText(row: RawRow, headerIndex: Map<HeaderKey, number>, key: HeaderKey): string {
  const col = headerIndex.get(key);
  if (col === undefined) return "";
  return cellValueText(row[col]);
}

function readImportText(row: RawRow, headerIndex: Map<HeaderKey, number>, key: HeaderKey): string {
  const text = readText(row, headerIndex, key);
  if (key === "externalId") {
    const trimmed = text.trim();
    if (trimmed.startsWith("=") || isGeneratedExternalId(trimmed)) return "";
  }
  return text;
}

function makeLookup(records: LookupRecord[]) {
  const map = new Map<string, LookupRecord[]>();
  for (const record of records) {
    const key = normalizeLookup(record.name);
    map.set(key, [...(map.get(key) ?? []), record]);
  }
  return map;
}

function findUniqueByName(map: Map<string, LookupRecord[]>, value: string, label: string): LookupRecord | string {
  const key = normalizeLookup(value);
  if (!key) return `${label} requis`;
  const matches = map.get(key) ?? [];
  if (matches.length === 0) return `${label} introuvable: ${value}`;
  if (matches.length > 1) return `${label} ambigu: ${value}`;
  return matches[0];
}

function isEmptyRow(row: RawRow, headerIndex: Map<HeaderKey, number>) {
  return Array.from(headerIndex.keys()).every((key) => !String(readImportText(row, headerIndex, key)).trim());
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if ((char === "," || char === ";") && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

async function loadRows(buffer: Buffer, fileName: string): Promise<RawRow[]> {
  if (fileName.toLowerCase().endsWith(".csv")) {
    return buffer
      .toString("utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map(parseCsvLine);
  }

  const readRows = readXlsxFile as unknown as ReadWorkbookRows;
  const result = await readRows(buffer);
  if (!Array.isArray(result)) return [];
  const first = result[0] as unknown;
  if (Array.isArray(first)) return result as RawRow[];

  const sheets = result as WorkbookSheetResult[];
  const selected = sheets.find((sheet) => sheet.sheet === "Membres" || sheet.name === "Membres") ?? sheets[0];
  if (Array.isArray(selected?.data)) {
    return selected.data;
  }

  return [];
}

async function prepareBulkImport(buffer: Buffer, fileName: string, fallbackCutoverDate: string): Promise<PreparedRow[]> {
  const rows = await loadRows(buffer, fileName);
  if (rows.length === 0) throw new Error("BULK_IMPORT_EMPTY_WORKBOOK");

  const headerIndex = buildHeaderIndex(rows[0]);
  const requiredHeaders: HeaderKey[] = ["firstName", "lastName", "memberType", "groupName", "planName"];
  const missingHeaders = requiredHeaders.filter((header) => !headerIndex.has(header));
  if (missingHeaders.length > 0) {
    throw new Error(`BULK_IMPORT_MISSING_HEADERS:${missingHeaders.join(",")}`);
  }

  const [groups, plans] = await Promise.all([
    prisma.group.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sportId: true },
    }),
    prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sportId: true, price: true, totalSessions: true, validityDays: true },
    }),
  ]);
  const groupLookup = makeLookup(groups);
  const planLookup = makeLookup(plans);
  const preparedRows: PreparedRow[] = [];
  const seenPhones = new Map<string, number>();
  const seenExternalIds = new Map<string, number>();
  const fallbackCutoverIso = parseDate(fallbackCutoverDate) ?? new Date().toISOString();
  let generatedExternalSequence = 0;

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const rowNumber = rowIndex + 1;
    const row = rows[rowIndex];
    if (isEmptyRow(row, headerIndex)) continue;
    generatedExternalSequence += 1;

    const errors: string[] = [];
    const firstName = readText(row, headerIndex, "firstName");
    const lastName = readText(row, headerIndex, "lastName");
    const phone = readText(row, headerIndex, "phone");
    const parentPhone = readText(row, headerIndex, "parentPhone");
    const externalId =
      readImportText(row, headerIndex, "externalId") ||
      generateExternalId(generatedExternalSequence, firstName, lastName, phone, parentPhone);
    const groupName = readText(row, headerIndex, "groupName");
    const planName = readText(row, headerIndex, "planName");
    const memberType = normalizeMemberType(readText(row, headerIndex, "memberType"));
    const groupMatch = findUniqueByName(groupLookup, groupName, "Groupe");
    const planMatch = findUniqueByName(planLookup, planName, "Formule");

    if (!memberType) errors.push("Type membre invalide (ADULT ou KID)");
    if (typeof groupMatch === "string") errors.push(groupMatch);
    if (typeof planMatch === "string") errors.push(planMatch);

    if (typeof groupMatch !== "string" && typeof planMatch !== "string" && groupMatch.sportId !== planMatch.sportId) {
      errors.push("La formule ne correspond pas a la discipline du groupe");
    }

    const cutoverDate = fallbackCutoverIso;
    const joinedAt = parseDate(readCell(row, headerIndex, "joinedAt")) ?? fallbackCutoverIso;
    const subscriptionStartDate = parseDate(readCell(row, headerIndex, "subscriptionStartDate")) ?? joinedAt;
    const subscriptionEndDate =
      parseDate(readCell(row, headerIndex, "subscriptionEndDate")) ??
      (typeof planMatch === "string" ? null : addDaysIso(subscriptionStartDate, planMatch.validityDays ?? 30));
    const assignmentStartDate = parseDate(readCell(row, headerIndex, "assignmentStartDate")) ?? subscriptionStartDate;
    const amountCents =
      parseMoneyCents(readCell(row, headerIndex, "amount")) ??
      (typeof planMatch === "string" ? 0 : planMatch.price ?? 0);
    const paidCents = parseMoneyCents(readCell(row, headerIndex, "paid")) ?? 0;
    const remainingSessions =
      parseInteger(readCell(row, headerIndex, "remainingSessions")) ??
      (typeof planMatch === "string" ? 0 : planMatch.totalSessions ?? 0);
    const paymentDate = parseDate(readCell(row, headerIndex, "paymentDate")) ?? fallbackCutoverIso;

    if (!subscriptionEndDate) errors.push("Date fin abonnement invalide");

    const member = {
      firstName,
      lastName,
      phone,
      email: readText(row, headerIndex, "email"),
      memberType: memberType ?? "NOT_SPECIFIED",
      birthDate: parseDate(readCell(row, headerIndex, "birthDate")) ?? "",
      address: readText(row, headerIndex, "address"),
      parentName: readText(row, headerIndex, "parentName"),
      parentPhone,
      joinedAt,
    };

    const phoneKey = resolveMemberPhone(member);
    if (phoneKey) {
      const duplicateRow = seenPhones.get(phoneKey);
      if (duplicateRow) errors.push(`Telephone en double avec la ligne ${duplicateRow}`);
      seenPhones.set(phoneKey, rowNumber);
    }

    const externalKey = normalizeLookup(externalId);
    if (externalKey) {
      const duplicateRow = seenExternalIds.get(externalKey);
      if (duplicateRow) errors.push(`Référence en double avec la ligne ${duplicateRow}`);
      seenExternalIds.set(externalKey, rowNumber);
    }

    const payload: DataImportPayload | undefined =
      typeof groupMatch === "string" || typeof planMatch === "string" || !subscriptionEndDate
        ? undefined
        : {
            cutoverDate,
            member,
            groupId: groupMatch.id,
            planId: planMatch.id,
            assignmentStartDate,
            subscriptionStartDate,
            subscriptionEndDate,
            amountCents,
            paidCents,
            remainingSessions,
            paymentDate: paidCents > 0 ? paymentDate : "",
            paymentMethod: readText(row, headerIndex, "paymentMethod") || "REPRISE_EXCEL",
            note: readText(row, headerIndex, "note") || `Reprise Excel ${externalId}`,
            attendances: [],
          };

    if (payload) {
      const parsed = dataImportPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        for (const [field, messages] of Object.entries(fieldErrors)) {
          for (const message of messages ?? []) errors.push(`${field}: ${message}`);
        }
      }
    }

    preparedRows.push({
      result: {
        rowNumber,
        externalId,
        memberName: `${firstName} ${lastName}`.trim(),
        groupName,
        planName,
        status: errors.length > 0 ? "ERROR" : "OK",
        errors,
        warnings: [],
        remainingBalanceCents: Math.max(0, amountCents - paidCents),
      },
      payload: errors.length === 0 ? payload : undefined,
    });
  }

  return preparedRows;
}

export async function previewBulkDataImport(
  buffer: Buffer,
  fileName: string,
  fallbackCutoverDate: string,
): Promise<BulkImportResult> {
  const preparedRows = await prepareBulkImport(buffer, fileName, fallbackCutoverDate);
  return previewPreparedRows(preparedRows);
}

export async function applyBulkDataImport(
  buffer: Buffer,
  fileName: string,
  fallbackCutoverDate: string,
  actorId: string,
): Promise<BulkImportResult> {
  const preparedRows = await prepareBulkImport(buffer, fileName, fallbackCutoverDate);
  const preview = await previewPreparedRows(preparedRows);
  if (preview.errorRows > 0) return preview;

  const importedRows: BulkImportRowResult[] = [];
  for (const row of preparedRows) {
    if (!row.payload) continue;
    const applied = await applyDataImport(row.payload, actorId);
    importedRows.push({ ...row.result, status: "IMPORTED", memberId: applied.memberId });
  }

  return summarizeRows(importedRows);
}

async function previewPreparedRows(preparedRows: PreparedRow[]): Promise<BulkImportResult> {
  const queuedByGroup = new Map<string, number>();

  for (const row of preparedRows) {
    if (!row.payload || row.result.errors.length > 0) continue;
    try {
      const context = await inspectDataImport(row.payload);
      const queuedCount = queuedByGroup.get(context.group.id) ?? 0;
      if (context.group.activeMembers + queuedCount >= context.group.capacity) {
        row.result.status = "ERROR";
        row.result.errors.push("Capacite du groupe atteinte avec les lignes de ce fichier");
        continue;
      }
      queuedByGroup.set(context.group.id, queuedCount + 1);
      row.result.warnings = context.inspection.warnings;
      row.result.remainingBalanceCents = context.inspection.remainingBalanceCents;
    } catch (error) {
      row.result.status = "ERROR";
      row.result.errors.push(dataImportErrorMessage(error));
    }
  }
  return summarizeRows(preparedRows.map((row) => row.result));
}

function summarizeRows(rows: BulkImportRowResult[]): BulkImportResult {
  const errorRows = rows.filter((row) => row.status === "ERROR").length;
  const importedRows = rows.filter((row) => row.status === "IMPORTED").length;
  return {
    totalRows: rows.length,
    okRows: rows.filter((row) => row.status === "OK").length,
    errorRows,
    importedRows,
    rows,
  };
}
