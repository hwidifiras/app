import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { runSerializableTransaction } from "@/lib/serializable-transaction";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export class InvalidIdempotencyKeyError extends Error {
  constructor() {
    super("IDEMPOTENCY_KEY_INVALID");
  }
}

export class IdempotencyKeyConflictError extends Error {
  constructor() {
    super("IDEMPOTENCY_KEY_CONFLICT");
  }
}

export function describeIdempotencyError(error: unknown) {
  if (error instanceof InvalidIdempotencyKeyError) {
    return { status: 400, error: "Clé d'idempotence invalide", code: error.message } as const;
  }
  if (error instanceof IdempotencyKeyConflictError) {
    return {
      status: 409,
      error: "Cette clé d'idempotence a déjà servi pour une autre requête",
      code: error.message,
    } as const;
  }
  return null;
}

export function readIdempotencyKey(request: Request): string | null {
  const raw = request.headers.get("idempotency-key");
  if (raw === null) return null;

  const key = raw.trim();
  if (!key || key.length > 200 || /[\u0000-\u0020\u007f]/.test(key)) {
    throw new InvalidIdempotencyKeyError();
  }
  return key;
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => [key, canonicalize(record[key])]),
  );
}

export function hashIdempotencyRequest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

export type StoredHttpResponse<T> = {
  status: number;
  body: T;
};

export type IdempotentTransactionOutcome<T> = {
  response: StoredHttpResponse<T>;
  replayed: boolean;
  idempotencyKey: string | null;
};

export type IdempotentTransactionParams = {
  tenantId: string;
  scope: string;
  idempotencyKey: string | null;
  requestPayload: unknown;
  ttlMs?: number;
};

export async function replayIdempotentResponse<T>(
  params: IdempotentTransactionParams,
): Promise<IdempotentTransactionOutcome<T> | null> {
  if (!params.idempotencyKey) return null;
  const requestHash = hashIdempotencyRequest(params.requestPayload);
  const stored = await runSerializableTransaction((tx) =>
    readStoredResponse<T>(tx, params, requestHash),
  );
  return stored
    ? { response: stored, replayed: true, idempotencyKey: params.idempotencyKey }
    : null;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function readStoredResponse<T>(
  tx: Prisma.TransactionClient,
  params: IdempotentTransactionParams,
  requestHash: string,
): Promise<StoredHttpResponse<T> | null> {
  if (!params.idempotencyKey) return null;

  const now = new Date();
  const existing = await tx.idempotencyRecord.findUnique({
    where: {
      tenantId_scope_key: {
        tenantId: params.tenantId,
        scope: params.scope,
        key: params.idempotencyKey,
      },
    },
  });
  if (!existing) return null;

  if (existing.expiresAt <= now) {
    await tx.idempotencyRecord.delete({ where: { id: existing.id } });
    return null;
  }
  if (existing.requestHash !== requestHash) {
    throw new IdempotencyKeyConflictError();
  }

  return {
    status: existing.responseStatus,
    body: JSON.parse(existing.responseBody) as T,
  };
}

export async function runIdempotentSerializableTransaction<T>(
  params: IdempotentTransactionParams,
  operation: (tx: Prisma.TransactionClient) => Promise<StoredHttpResponse<T>>,
): Promise<IdempotentTransactionOutcome<T>> {
  const requestHash = hashIdempotencyRequest(params.requestPayload);

  try {
    return await runSerializableTransaction(async (tx) => {
      const stored = await readStoredResponse<T>(tx, params, requestHash);
      if (stored) {
        return { response: stored, replayed: true, idempotencyKey: params.idempotencyKey };
      }

      const response = await operation(tx);
      if (params.idempotencyKey) {
        await tx.idempotencyRecord.create({
          data: {
            tenantId: params.tenantId,
            scope: params.scope,
            key: params.idempotencyKey,
            requestHash,
            responseStatus: response.status,
            responseBody: JSON.stringify(response.body),
            expiresAt: new Date(Date.now() + (params.ttlMs ?? IDEMPOTENCY_TTL_MS)),
          },
        });
      }

      return { response, replayed: false, idempotencyKey: params.idempotencyKey };
    });
  } catch (error) {
    if (!params.idempotencyKey || !isUniqueConstraintError(error)) throw error;

    const stored = await runSerializableTransaction((tx) =>
      readStoredResponse<T>(tx, params, requestHash),
    );
    if (!stored) throw error;
    return { response: stored, replayed: true, idempotencyKey: params.idempotencyKey };
  }
}

export function idempotencyResponseHeaders(replayed: boolean): HeadersInit | undefined {
  return replayed ? { "Idempotency-Replayed": "true" } : undefined;
}
