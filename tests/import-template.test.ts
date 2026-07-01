import path from "node:path";

import readXlsxFile from "read-excel-file/node";
import { describe, expect, it } from "vitest";

const expectedHeaders = [
  "Code membre auto (laisser vide)",
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
});
