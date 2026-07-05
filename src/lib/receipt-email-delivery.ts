import { sendReceiptEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { parseReceiptSnapshot } from "@/lib/receipts";

type ReceiptEmailFailureCode =
  | "RECEIPT_NOT_FOUND"
  | "RECEIPT_VOIDED"
  | "RECEIPT_INVALID"
  | "NO_EMAIL"
  | "EMAIL_NOT_CONFIGURED"
  | "EMAIL_SEND_FAILED";

export type ReceiptEmailDeliveryResult =
  | { delivered: true; email: string }
  | {
      delivered: false;
      code: ReceiptEmailFailureCode;
      error: string;
      status: number;
      email?: string;
    };

export function buildReceiptVerificationUrl(
  requestUrl: string,
  receiptNumber: string,
  verificationCode: string,
) {
  const url = new URL("/receipts/verify", requestUrl);
  url.searchParams.set("receiptNumber", receiptNumber);
  url.searchParams.set("code", verificationCode);
  return url.toString();
}

export async function sendReceiptEmailForReceipt({
  receiptId,
  requestUrl,
  actorId,
  targetEmail,
}: {
  receiptId: string;
  requestUrl: string;
  actorId: string;
  targetEmail?: string | null;
}): Promise<ReceiptEmailDeliveryResult> {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      payment: {
        select: {
          id: true,
          memberSubscription: {
            select: {
              member: {
                select: {
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!receipt) {
    return { delivered: false, code: "RECEIPT_NOT_FOUND", error: "Recu introuvable", status: 404 };
  }

  if (receipt.status === "VOIDED") {
    return {
      delivered: false,
      code: "RECEIPT_VOIDED",
      error: "Impossible d'envoyer un recu annule",
      status: 409,
    };
  }

  const snapshot = parseReceiptSnapshot(receipt);
  if (!snapshot) {
    return { delivered: false, code: "RECEIPT_INVALID", error: "Recu illisible", status: 409 };
  }

  const email = targetEmail?.trim() || receipt.payment.memberSubscription.member.email?.trim() || "";
  if (!email) {
    return {
      delivered: false,
      code: "NO_EMAIL",
      error: "Aucun email membre disponible",
      status: 409,
    };
  }

  const verificationUrl = buildReceiptVerificationUrl(
    requestUrl,
    receipt.receiptNumber,
    receipt.verificationCode,
  );
  const memberName =
    snapshot.member.name ||
    `${receipt.payment.memberSubscription.member.firstName} ${receipt.payment.memberSubscription.member.lastName}`.trim() ||
    "Membre";
  const delivery = await sendReceiptEmail({
    to: email,
    memberName,
    clubName: snapshot.club.name || "Club",
    receiptNumber: receipt.receiptNumber,
    amountCents: snapshot.payment.amountCents,
    paymentDate: new Date(snapshot.payment.paymentDate).toLocaleDateString("fr-FR"),
    verificationCode: receipt.verificationCode,
    verificationUrl,
  });

  await prisma.auditLog.create({
    data: {
      action: delivery.delivered ? "RECEIPT_EMAIL_SENT" : "RECEIPT_EMAIL_FAILED",
      entityType: "Receipt",
      entityId: receipt.id,
      userId: actorId,
      details: JSON.stringify({
        receiptNumber: receipt.receiptNumber,
        paymentId: receipt.paymentId,
        email,
        delivered: delivery.delivered,
        reason: delivery.delivered ? null : delivery.reason,
      }),
    },
  });

  if (!delivery.delivered) {
    return {
      delivered: false,
      code: delivery.reason,
      error:
        delivery.reason === "EMAIL_NOT_CONFIGURED"
          ? "Email non configure sur le serveur"
          : "Echec d'envoi email",
      status: 503,
      email,
    };
  }

  return { delivered: true, email };
}
