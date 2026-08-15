import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonAuthFailureResponse, requireAnyPermission } from "@/lib/permissions";
import { sendReceiptEmailForReceipt } from "@/lib/receipt-email-delivery";

export const runtime = "nodejs";

const sendReceiptSchema = z.object({
  email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let actor;
  try {
    actor = await requireAnyPermission(request, ["payments.collect", "reports.finance"]);
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
    tenantId: actor.tenantId,
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
