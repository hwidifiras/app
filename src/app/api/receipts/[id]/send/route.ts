import { NextResponse } from "next/server";
import { z } from "zod";

import { sendReceiptEmail } from "@/lib/email";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseReceiptSnapshot } from "@/lib/receipts";

export const runtime = "nodejs";

const sendReceiptSchema = z.object({
  email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
});

function buildVerificationUrl(requestUrl: string, receiptNumber: string, verificationCode: string) {
  const url = new URL("/receipts/verify", requestUrl);
  url.searchParams.set("receiptNumber", receiptNumber);
  url.searchParams.set("code", verificationCode);
  return url.toString();
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let actor;
  try {
    actor = await requirePermission(request, "payments.manage");
  } catch (error) {
    return jsonAuthFailureResponse(error);
  }

  const { id } = await params;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = sendReceiptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation echouee", details: parsed.error.flatten() }, { status: 400 });
  }

  const receipt = await prisma.receipt.findUnique({
    where: { id },
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
    return NextResponse.json({ error: "Recu introuvable" }, { status: 404 });
  }

  if (receipt.status === "VOIDED") {
    return NextResponse.json({ error: "Impossible d'envoyer un recu annule" }, { status: 409 });
  }

  const snapshot = parseReceiptSnapshot(receipt);
  if (!snapshot) {
    return NextResponse.json({ error: "Recu illisible" }, { status: 409 });
  }

  const targetEmail = parsed.data.email?.trim() || receipt.payment.memberSubscription.member.email?.trim() || "";
  if (!targetEmail) {
    return NextResponse.json({ error: "Aucun email membre disponible" }, { status: 409 });
  }

  const verificationUrl = buildVerificationUrl(request.url, receipt.receiptNumber, receipt.verificationCode);
  const delivery = await sendReceiptEmail({
    to: targetEmail,
    memberName:
      snapshot.member.name ||
      `${receipt.payment.memberSubscription.member.firstName} ${receipt.payment.memberSubscription.member.lastName}`.trim(),
    clubName: snapshot.club.name,
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
      userId: actor.id,
      details: JSON.stringify({
        receiptNumber: receipt.receiptNumber,
        paymentId: receipt.paymentId,
        email: targetEmail,
        delivered: delivery.delivered,
        reason: delivery.delivered ? null : delivery.reason,
      }),
    },
  });

  if (!delivery.delivered) {
    return NextResponse.json(
      {
        error:
          delivery.reason === "EMAIL_NOT_CONFIGURED"
            ? "Email non configure sur le serveur"
            : "Echec d'envoi email",
        reason: delivery.reason,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ data: { delivered: true, email: targetEmail } });
}
