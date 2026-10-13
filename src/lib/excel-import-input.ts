import { readSheet } from "read-excel-file/node";

export type ImportCell = string | number | boolean | Date | null | undefined;
export type ImportRows = ImportCell[][];
export const normalizeImportText = (value: unknown) => String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
export function importText(value: ImportCell): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "boolean") throw new Error("Valeur booléenne inattendue dans le fichier.");
  const text = String(value ?? "").trim();
  if (text.length > 2000 || text.includes("\0")) throw new Error("Cellule trop longue ou invalide.");
  return text;
}
export function importDate(value: string, label = "Date"): Date | null {
  if (!value) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const french = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(value);
  if (!iso && !french) throw new Error(`${label} invalide : utilisez AAAA-MM-JJ ou JJ/MM/AAAA.`);
  const year = Number(iso ? iso[1] : french![3]), month = Number(iso ? iso[2] : french![2]), day = Number(iso ? iso[3] : french![1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || year > 2200 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error(`${label} impossible : ${value}.`);
  return date;
}
export function importMoney(value: string, fallback: number, label: string): number {
  if (!value) return fallback;
  const cleaned = value.replace(/[ \u00a0\u202f]/g, "");
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(cleaned)) throw new Error(`${label} invalide : montant positif avec deux décimales maximum.`);
  const [whole, fraction = ""] = cleaned.split(/[.,]/);
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 2_147_483_647) throw new Error(`${label} trop élevé.`);
  return cents;
}
export function importUnits(value: string, maximum: number, label: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`${label} requis : nombre entier positif ou zéro.`);
  const units = Number(value);
  if (!Number.isSafeInteger(units) || units > maximum) throw new Error(`${label} dépasse les ${maximum} unités de la formule.`);
  return units;
}

function csvRows(text: string): ImportRows {
  text = text.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = firstLine.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++; }
      else if (!quoted && cell) throw new Error("Guillemets CSV invalides.");
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      row.push(cell); rows.push(row); row = []; cell = "";
      if (char === "\r" && text[index + 1] === "\n") index++;
    } else cell += char;
    if (rows.length > 1000 || cell.length > 2000 || row.length > 100) throw new Error("Fichier CSV trop volumineux.");
  }
  if (quoted) throw new Error("Guillemets CSV non fermés.");
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function checkXlsxSize(buffer: Buffer) {
  // Reject oversized compressed workbooks before the XML reader allocates them.
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error("Fichier Excel invalide.");
  const entries = buffer.readUInt16LE(end + 10);
  if (entries > 5000 || buffer.readUInt16LE(end + 4) !== 0) throw new Error("Classeur Excel trop volumineux.");
  let offset = buffer.readUInt32LE(end + 16), total = 0;
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Structure Excel invalide.");
    total += buffer.readUInt32LE(offset + 24);
    if (total > 40 * 1024 * 1024 || (buffer.readUInt16LE(offset + 8) & 1)) throw new Error("Classeur trop volumineux ou protégé.");
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
}
export async function readImportRows(buffer: Buffer, fileName: string): Promise<ImportRows> {
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new Error("Fichier vide ou supérieur à 5 Mo.");
  let rows: ImportRows;
  if (/\.csv$/i.test(fileName)) rows = csvRows(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
  else if (/\.xlsx$/i.test(fileName)) { checkXlsxSize(buffer); rows = await readSheet(buffer, 1) as unknown as ImportRows; }
  else throw new Error("Formats acceptés : .xlsx ou .csv.");
  if (!rows.length || rows[0].length > 100 || rows.some((row) => row.length > 100)) throw new Error("En-têtes Excel invalides.");
  const populated = rows.slice(1).filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ""));
  if (!populated.length) throw new Error("Le fichier ne contient aucun élève.");
  if (populated.length > 200 || rows.length > 1000) throw new Error("Maximum 200 élèves par fichier. Divisez le fichier en plusieurs lots.");
  return rows;
}
