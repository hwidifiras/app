import { normalizeDocumentCreate, validateDocumentReferences, enforceDocumentDelete, getDocumentClient, withDocumentClient } from "@/lib/document-relations";

import { withDocumentFence } from "@/lib/document-transaction";

import { PrismaClient } from "@prisma/client";

import { enterTenantContext, getTenantContext, isTenantScopedModel } from "@/lib/tenant-context";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function assertTenantId(value: unknown, tenantId: string) {
  if (value === undefined || value === null) return;
  if (typeof value === "string" && value === tenantId) return;
  if (typeof value === "object" && value !== null && "set" in value && (value as { set?: unknown }).set === tenantId) {
    return;
  }
  throw new Error("TENANT_SCOPE_VIOLATION");
}

function withTenantWhere(where: Record<string, unknown> | undefined, tenantId: string) {
  assertTenantId(where?.tenantId, tenantId);
  return { ...(where ?? {}), tenantId };
}

function withTenantData(data: unknown, tenantId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => withTenantData(item, tenantId));
  }

  if (!data || typeof data !== "object") return data;

  const record = data as Record<string, unknown>;
  assertTenantId(record.tenantId, tenantId);
  return { ...record, tenantId };
}

function assertNoTenantMutation(data: unknown, tenantId: string): void {
  if (!data || typeof data !== "object" || Array.isArray(data)) return;
  assertTenantId((data as Record<string, unknown>).tenantId, tenantId);
}

async function tenantIdFromRequestHeaders(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    const requestHeaders = await headers();
    const tenantId = requestHeaders.get("x-tenant-id")?.trim();
    if (!tenantId) return null;

    enterTenantContext({
      tenantId,
      tenantSlug: requestHeaders.get("x-tenant-slug")?.trim() || "unknown",
      host: requestHeaders.get("host") ?? requestHeaders.get("x-forwarded-host") ?? undefined,
    });

    return tenantId;
  } catch {
    return null;
  }
}

async function tenantIdForModel(model: string | undefined): Promise<string | null> {
  if (!isTenantScopedModel(model)) return null;
  const tenantId = getTenantContext()?.tenantId ?? (await tenantIdFromRequestHeaders());
  if (!tenantId) throw new Error("TENANT_CONTEXT_REQUIRED");
  return tenantId;
}

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

export async function checkDatabaseReadiness(): Promise<void> {
  await basePrisma.$runCommandRaw({ ping: 1 });
}

/**
 * Deliberately narrow public lookup. Keep the unscoped Prisma client private so
 * application code cannot accidentally bypass tenant enforcement.
 */
export async function findPublicReceiptByVerificationCode(input: {
  tenantId: string;
  receiptNumber: string;
  verificationCode: string;
}) {
  return basePrisma.receipt.findFirst({
    where: {
      tenantId: input.tenantId,
      receiptNumber: input.receiptNumber,
      verificationCode: input.verificationCode,
    },
    select: {
      status: true,
      snapshotJson: true,
    },
  });
}

const scopedPrisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (operation === "findRaw" || operation === "aggregateRaw") throw new Error("UNSCOPED_DOCUMENT_READ_FORBIDDEN");
        const tenantId = await tenantIdForModel(model);


        const scopedArgs = { ...(args as Record<string, unknown>) };

        if (tenantId && (
          operation === "findUnique" ||
          operation === "findUniqueOrThrow" ||
          operation === "findFirst" ||
          operation === "findFirstOrThrow" ||
          operation === "findMany" ||
          operation === "count" ||
          operation === "aggregate" ||
          operation === "groupBy" ||
          operation === "update" ||
          operation === "updateMany" ||
          operation === "delete" ||
          operation === "deleteMany"
        )) {
          scopedArgs.where = withTenantWhere(scopedArgs.where as Record<string, unknown> | undefined, tenantId);
        }

        if (tenantId && operation === "create") {
          scopedArgs.data = withTenantData(scopedArgs.data, tenantId);
        }

        if (tenantId && operation === "createMany") {
          const data = (scopedArgs.data ?? []) as unknown;
          scopedArgs.data = withTenantData(data, tenantId);
        }

        if (tenantId && (operation === "update" || operation === "updateMany")) {
          assertNoTenantMutation(scopedArgs.data, tenantId);
        }

        if (tenantId && operation === "upsert") {
          scopedArgs.where = withTenantWhere(scopedArgs.where as Record<string, unknown> | undefined, tenantId);
          scopedArgs.create = withTenantData(scopedArgs.create, tenantId);
          assertNoTenantMutation(scopedArgs.update, tenantId);
        }

        if (operation === "create" || operation === "createMany") scopedArgs.data = normalizeDocumentCreate(model!, scopedArgs.data);
        if (operation === "upsert") scopedArgs.create = normalizeDocumentCreate(model!, scopedArgs.create);
        const mutation = ["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"].includes(operation);
        if (!mutation) return query(scopedArgs);
        if (model === "PlatformAuditLog" && operation !== "create" && operation !== "createMany") throw new Error("PLATFORM_AUDIT_APPEND_ONLY");
        const guard = async (client: PrismaClient | import("@prisma/client").Prisma.TransactionClient) => {
          await validateDocumentReferences(client, model!, scopedArgs.data ?? scopedArgs.create, tenantId);
          if (operation === "upsert") await validateDocumentReferences(client, model!, scopedArgs.update, tenantId);
          if (operation === "delete" || operation === "deleteMany") await enforceDocumentDelete(client, model!, scopedArgs.where);
        };
        const client = getDocumentClient();
        if (client) { await guard(client); return query(scopedArgs); }
        return withDocumentFence(() => basePrisma.$transaction(async (tx) => withDocumentClient(tx, async () => {
          await guard(tx);
          const name = model![0].toLowerCase() + model!.slice(1);
          const modelDelegate = (tx as unknown as Record<string, Record<string, (args: unknown) => Promise<unknown>>>)[name];
          return modelDelegate[operation](scopedArgs);
        })));

      },
    },
  },
}) as unknown as PrismaClient;

const documentTransaction = scopedPrisma.$transaction.bind(scopedPrisma);
export const prisma = new Proxy(scopedPrisma, {
  get(target, property, receiver) {
    if (property === "$transaction") return (operation: unknown, options?: Record<string, unknown>) => withDocumentFence(async () => {
      const safeOptions = { ...options }; delete safeOptions.isolationLevel;
      for (let attempt = 0; ; attempt++) {
        try {
          if (typeof operation === "function") return await documentTransaction((tx) => withDocumentClient(tx, () => operation(tx)), safeOptions);
          throw new Error("DOCUMENT_TRANSACTIONS_REQUIRE_CALLBACK");
        }
        catch (error) {
          if (attempt >= 4 || !(error && typeof error === "object" && "code" in error && error.code === "P2034")) throw error;
          await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
        }
      }
    });
    return Reflect.get(target, property, receiver);
  },
}) as PrismaClient;
