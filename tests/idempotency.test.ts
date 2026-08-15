import { describe, expect, it } from "vitest";

import {
  InvalidIdempotencyKeyError,
  hashIdempotencyRequest,
  readIdempotencyKey,
} from "@/lib/idempotency";

describe("idempotency request contract", () => {
  it("hashes semantically identical object payloads consistently", () => {
    expect(hashIdempotencyRequest({ amount: 500, nested: { b: 2, a: 1 } })).toBe(
      hashIdempotencyRequest({ nested: { a: 1, b: 2 }, amount: 500 }),
    );
  });

  it("keeps array order significant", () => {
    expect(hashIdempotencyRequest({ memberIds: ["a", "b"] })).not.toBe(
      hashIdempotencyRequest({ memberIds: ["b", "a"] }),
    );
  });

  it("accepts a bounded opaque key and rejects blank or whitespace-bearing keys", () => {
    expect(
      readIdempotencyKey(
        new Request("http://test.local", { headers: { "Idempotency-Key": "gymday:abc-123" } }),
      ),
    ).toBe("gymday:abc-123");

    expect(() =>
      readIdempotencyKey(new Request("http://test.local", { headers: { "Idempotency-Key": "bad key" } })),
    ).toThrow(InvalidIdempotencyKeyError);
  });
});
