import { PrismaClient } from "@prisma/client";

import { getTenantId, isTenantScopedModel } from "@/lib/tenant-context";

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

function tenantIdForModel(model: string | undefined): string | null {
  if (!isTenantScopedModel(model)) return null;
  const tenantId = getTenantId();
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

export const unscopedPrisma = basePrisma;

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const tenantId = tenantIdForModel(model);
        if (!tenantId) return query(args);

        const scopedArgs = { ...(args as Record<string, unknown>) };

        if (
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
        ) {
          scopedArgs.where = withTenantWhere(scopedArgs.where as Record<string, unknown> | undefined, tenantId);
        }

        if (operation === "create") {
          scopedArgs.data = withTenantData(scopedArgs.data, tenantId);
        }

        if (operation === "createMany" || operation === "createManyAndReturn") {
          const data = (scopedArgs.data ?? []) as unknown;
          scopedArgs.data = withTenantData(data, tenantId);
        }

        if (operation === "update" || operation === "updateMany" || operation === "updateManyAndReturn") {
          assertNoTenantMutation(scopedArgs.data, tenantId);
        }

        if (operation === "upsert") {
          scopedArgs.where = withTenantWhere(scopedArgs.where as Record<string, unknown> | undefined, tenantId);
          scopedArgs.create = withTenantData(scopedArgs.create, tenantId);
          assertNoTenantMutation(scopedArgs.update, tenantId);
        }

        return query(scopedArgs);
      },
    },
  },
}) as unknown as PrismaClient;
