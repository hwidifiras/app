import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { sendReceiptEmailForReceipt } from "@/lib/receipt-email-delivery";

export const runtime = "nodejs";

const sendReceiptSchema = z.object({
  email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
});

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

  const delivery = await sendReceiptEmailForReceipt({
    receiptId: id,
    requestUrl: request.url,
    actorId: actor.id,
    targetEmail: parsed.data.email,
  });

  if (!delivery.delivered) {
    return NextResponse.json(
      { error: delivery.error, reason: delivery.code },
      { status: delivery.status },
    );
  }

  return NextResponse.json({ data: { delivered: true, email: delivery.email } });
}
