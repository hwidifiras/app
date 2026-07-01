import path from "node:path";

import readXlsxFile from "read-excel-file/node";
import { describe, expect, it } from "vitest";

const expectedHeaders = [
  "Prénom",
  "Nom",
  "Type membre",
  "Téléphone",
  "Email",
  "Date naissance",
  "Adresse",
  "Nom parent",
  "Téléphone parent",
  "Date inscription",
  "Groupe",
  "Formule",
  "Début groupe",
  "Début abonnement",
  "Fin abonnement",
  "Montant total",
  "Déjà payé",
  "Séances restantes",
  "Date paiement",
  "Mode paiement",
  "Note reprise",
];

type SheetResult = {
  sheet?: string;
  data?: unknown[][];
};

async function readMembersSheet(fileName: string) {
  const templatePath = path.join(process.cwd(), "public", "templates", fileName);
  const result = (await readXlsxFile(templatePath)) as unknown;
  if (!Array.isArray(result)) return [];
  const first = result[0] as unknown;
  if (Array.isArray(first)) return result as unknown[][];
  return ((result as SheetResult[]).find((sheet) => sheet.sheet === "Membres")?.data ?? []) as unknown[][];
}

async function readExampleSheet(fileName: string) {
  const templatePath = path.join(process.cwd(), "public", "templates", fileName);
  const result = (await readXlsxFile(templatePath)) as unknown;
  if (!Array.isArray(result)) return [];
  const first = result[0] as unknown;
  if (Array.isArray(first)) return [];
  return ((result as SheetResult[]).find((sheet) => sheet.sheet === "Exemple")?.data ?? []) as unknown[][];
}

describe("bulk import templates", () => {
  it.each([
    "we-discipline-reprise-membres.xlsx",
    "we-discipline-first-client-bulk-import.xlsx",
  ])("uses French client-facing headers in %s", async (fileName) => {
    const rows = await readMembersSheet(fileName);

    expect(rows[0]).toEqual(expectedHeaders);
    expect(rows[0]).not.toContain("externalId");
    expect(rows[0]).not.toContain("firstName");
  });

  it.each([
    "we-discipline-reprise-membres.xlsx",
    "we-discipline-first-client-bulk-import.xlsx",
  ])("keeps example headers French and hides auto-code cells in %s", async (fileName) => {
    const rows = await readExampleSheet(fileName);

    expect(rows[0]).toEqual(expectedHeaders);
    expect(rows[0]).not.toContain("Code membre auto");
    expect(rows[1]?.[0]).toBe("Amine");
    expect(rows[2]?.[0]).toBe("Nour");
  });
});
