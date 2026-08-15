"use client";

import { useCallback, useRef } from "react";

type PendingIntent = {
  key: string;
  createdAt: number;
};

const CLIENT_INTENT_TTL_MS = 23 * 60 * 60 * 1000;

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

function fingerprint(payload: unknown): string {
  return JSON.stringify(canonicalize(payload));
}

export function createIdempotencyKey(): string {
  return `gymday:${globalThis.crypto.randomUUID()}`;
}

/**
 * Keeps one key per semantic request payload. Network retries and rapid repeated
 * submissions reuse it; a successful response retires it so the next action is
 * treated as a new intent.
 */
export function useIdempotencyIntent() {
  const pending = useRef(new Map<string, PendingIntent>());

  const keyFor = useCallback((payload: unknown) => {
    const payloadFingerprint = fingerprint(payload);
    const existing = pending.current.get(payloadFingerprint);
    if (existing && Date.now() - existing.createdAt < CLIENT_INTENT_TTL_MS) {
      return existing.key;
    }

    const next = { key: createIdempotencyKey(), createdAt: Date.now() };
    pending.current.set(payloadFingerprint, next);
    return next.key;
  }, []);

  const complete = useCallback((payload: unknown) => {
    pending.current.delete(fingerprint(payload));
  }, []);

  return { keyFor, complete };
}
