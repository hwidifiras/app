import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  isSerializableTransactionConflict,
  runSerializableTransaction,
} from "@/lib/serializable-transaction";

describe("serializable transaction retries", () => {
  it("retries the entire callback after a Prisma serialization conflict", async () => {
    let transactionAttempts = 0;
    const transactionOptions: unknown[] = [];
    const client = {
      $transaction: vi.fn(async (callback: (tx: never) => Promise<string>, options: unknown) => {
        transactionAttempts += 1;
        transactionOptions.push(options);
        const value = await callback({} as never);
        if (transactionAttempts < 3) throw { code: "P2034" };
        return value;
      }),
    };

    const operation = vi.fn(async () => "committed");
    const result = await runSerializableTransaction(operation, {
      client: client as never,
      maxRetries: 2,
      retryDelayMs: () => 0,
    });

    expect(result).toBe("committed");
    expect(transactionAttempts).toBe(3);
    expect(operation).toHaveBeenCalledTimes(3);
    expect(transactionOptions).toEqual([
      expect.objectContaining({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
      expect.objectContaining({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
      expect.objectContaining({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
    ]);
  });

  it("does not retry non-transaction errors", async () => {
    const failure = new Error("OVERPAY");
    const client = {
      $transaction: vi.fn(async () => {
        throw failure;
      }),
    };

    await expect(
      runSerializableTransaction(async () => "unreachable", {
        client: client as never,
        maxRetries: 3,
        retryDelayMs: () => 0,
      }),
    ).rejects.toBe(failure);
    expect(client.$transaction).toHaveBeenCalledTimes(1);
  });

  it("recognizes Prisma and PostgreSQL serialization/deadlock codes", () => {
    expect(isSerializableTransactionConflict({ code: "P2034" })).toBe(true);
    expect(isSerializableTransactionConflict({ code: "40001" })).toBe(true);
    expect(isSerializableTransactionConflict({ code: "40P01" })).toBe(true);
    expect(isSerializableTransactionConflict({ code: "P2002" })).toBe(false);
    expect(isSerializableTransactionConflict(new Error("P2034"))).toBe(false);
  });
});
