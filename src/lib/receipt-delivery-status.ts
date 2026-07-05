export const RECEIPT_EMAIL_AUDIT_ACTIONS = ["RECEIPT_EMAIL_SENT", "RECEIPT_EMAIL_FAILED"] as const;

export type ReceiptDeliveryStatus = {
  delivered: boolean;
  email: string | null;
  createdAt: string;
  reason: string | null;
};

export function parseReceiptDeliveryDetails(details: string | null) {
  if (!details) return { email: null, delivered: null, reason: null };
  try {
    const parsed = JSON.parse(details) as {
      email?: unknown;
      delivered?: unknown;
      reason?: unknown;
    };
    return {
      email: typeof parsed.email === "string" ? parsed.email : null,
      delivered: typeof parsed.delivered === "boolean" ? parsed.delivered : null,
      reason: typeof parsed.reason === "string" ? parsed.reason : null,
    };
  } catch {
    return { email: null, delivered: null, reason: null };
  }
}

export function buildReceiptDeliveryStatus(log: {
  action: string;
  details: string | null;
  createdAt: Date | string;
}): ReceiptDeliveryStatus {
  const details = parseReceiptDeliveryDetails(log.details);
  return {
    delivered: details.delivered ?? log.action === "RECEIPT_EMAIL_SENT",
    email: details.email,
    createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : log.createdAt,
    reason: details.reason,
  };
}
