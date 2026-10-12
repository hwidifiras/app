import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma, type PrismaClient } from "@prisma/client";
import metadata from "../../offline/model-metadata.json";

type Document = Record<string, unknown>;
type Delegate = { findMany(args: unknown): Promise<Document[]>; findFirst(args: unknown): Promise<Document | null>; deleteMany(args: unknown): Promise<unknown>; updateMany(args: unknown): Promise<unknown> };
type Client = Prisma.TransactionClient | PrismaClient;
const storage = new AsyncLocalStorage<Client>();
export function withDocumentClient<T>(client: Client, operation: () => Promise<T>) { return storage.run(client, operation); }
export function getDocumentClient() { return storage.getStore(); }
function delegate(client: Client, model: string): Delegate { return (client as unknown as Record<string, Delegate>)[model[0].toLowerCase() + model.slice(1)]; }
function constraint(message: string): never { throw new Prisma.PrismaClientKnownRequestError(message, { code: "P2003", clientVersion: "6.19.3" }); }

const models = metadata.models as Record<string, { fields: Array<{ name: string; type: string; relation: boolean; optional: boolean }>; references: Array<{ model: string; fields: string[]; references: string[]; onDelete: string }> }>;

export function normalizeDocumentCreate(model: string, input: unknown): unknown {
  if (Array.isArray(input)) return input.map((row) => normalizeDocumentCreate(model, row));
  if (!input || typeof input !== "object") return input;
  const record = { ...(input as Document) };
  const connectedForeignKeys = new Set<string>();
  for (const field of models[model]?.fields.filter((f) => f.relation) ?? []) {
    const nested = record[field.name] as Document | undefined;
    if (!nested || typeof nested !== "object") continue;
    for (const reference of models[model].references.filter((r) => r.model === field.type)) for (const key of reference.fields) connectedForeignKeys.add(key);
    if (nested.create) record[field.name] = { ...nested, create: normalizeDocumentCreate(field.type, nested.create) };
  }
  // Mongo distinguishes omitted fields from null; old screens and lifecycle
  // filters use explicit nulls. Populate nullable scalars consistently.
  for (const field of models[model]?.fields ?? []) if (field.optional && !field.relation && record[field.name] === undefined && !connectedForeignKeys.has(field.name)) record[field.name] = null;
  return record;
}

export async function validateDocumentReferences(client: Client, model: string, data: unknown, tenantId?: string | null): Promise<void> {
  if (Array.isArray(data)) { for (const row of data) await validateDocumentReferences(client, model, row, tenantId); return; }
  if (!data || typeof data !== "object") return;
  const record = data as Document;
  if (tenantId && record.tenantId !== undefined && record.tenantId !== tenantId) constraint("TENANT_REFERENCE_MISMATCH");
  for (const reference of models[model]?.references ?? []) {
    const where: Document = {};
    let populated = true;
    reference.fields.forEach((field, index) => {
      const value = record[field];
      const scalar = value && typeof value === "object" && "set" in value ? (value as Document).set : value;
      if (scalar === undefined || scalar === null) populated = false;
      where[reference.references[index]] = scalar;
    });
    if (!populated) continue;
    const parent = await delegate(client, reference.model).findFirst({ where });
    if (!parent) constraint(tenantId ? "TENANT_REFERENCE_MISMATCH: DOCUMENT_REFERENCE_NOT_FOUND" : "DOCUMENT_REFERENCE_NOT_FOUND");
    if (tenantId && reference.model !== "Tenant" && parent.tenantId !== undefined && parent.tenantId !== tenantId) constraint("TENANT_REFERENCE_MISMATCH");
    if (tenantId && reference.model === "Tenant" && parent.id !== tenantId) constraint("TENANT_REFERENCE_MISMATCH");
  }
  for (const field of models[model]?.fields.filter((f) => f.relation) ?? []) {
    const nested = record[field.name] as Document | undefined;
    if (!nested || typeof nested !== "object") continue;
    if (nested.connect) {
      for (const where of Array.isArray(nested.connect) ? nested.connect : [nested.connect]) {
        const target = await delegate(client, field.type).findFirst({ where });
        if (!target) constraint("DOCUMENT_REFERENCE_NOT_FOUND");
        if (tenantId && target.tenantId !== undefined && target.tenantId !== tenantId) constraint("TENANT_REFERENCE_MISMATCH");
      }
    }
    if (nested.create) await validateDocumentReferences(client, field.type, nested.create, tenantId);
  }
}

export async function enforceDocumentDelete(client: Client, model: string, where: unknown, seen = new Set<string>()) {
  const parents = await delegate(client, model).findMany({ where });
  for (const parent of parents) {
    const key = `${model}:${parent.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const [childModel, child] of Object.entries(models)) for (const reference of child.references) {
      if (reference.model !== model) continue;
      const childWhere = Object.fromEntries(reference.fields.map((field, i) => [field, parent[reference.references[i]]]));
      const dependent = await delegate(client, childModel).findFirst({ where: childWhere });
      if (!dependent || (childModel === model && dependent.id === parent.id)) continue;
      if (reference.onDelete === "Cascade") {
        await enforceDocumentDelete(client, childModel, childWhere, seen);
        await delegate(client, childModel).deleteMany({ where: childWhere });
      } else if (reference.onDelete === "SetNull") {
        await delegate(client, childModel).updateMany({ where: childWhere, data: Object.fromEntries(reference.fields.map((field) => [field, null])) });
      } else constraint(`DOCUMENT_DELETE_RESTRICTED:${childModel}`);
    }
  }
}
