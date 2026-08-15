import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type TransactionRunner = Pick<PrismaClient, "$transaction">;

type SerializableTransactionOptions = {
  client?: TransactionRunner;
  maxRetries?: number;
  maxWaitMs?: number;
  timeoutMs?: number;
  retryDelayMs?: (retryNumber: number) => number;
};

function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  return typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : null;
}

export function isSerializableTransactionConflict(error: unknown): boolean {
  const code = errorCode(error);
  return code === "P2034" || code === "40001" || code === "40P01";
}

function defaultRetryDelayMs(retryNumber: number): number {
  const exponentialDelay = Math.min(25 * 2 ** Math.max(0, retryNumber - 1), 250);
  return exponentialDelay + Math.floor(Math.random() * 25);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs a read-then-write invariant at PostgreSQL SERIALIZABLE isolation.
 * Prisma reports serialization/deadlock conflicts as P2034; retrying the
 * entire callback makes every invariant read observe a fresh snapshot.
 */
export async function runSerializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options: SerializableTransactionOptions = {},
): Promise<T> {
  const client = options.client ?? prisma;
  const maxRetries = Math.max(0, options.maxRetries ?? 3);

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await client.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: options.maxWaitMs ?? 5_000,
        timeout: options.timeoutMs ?? 15_000,
      });
    } catch (error) {
      if (!isSerializableTransactionConflict(error) || attempt >= maxRetries) {
        throw error;
      }

      const retryNumber = attempt + 1;
      const delayMs = Math.max(0, (options.retryDelayMs ?? defaultRetryDelayMs)(retryNumber));
      if (delayMs > 0) await wait(delayMs);
    }
  }
}
