import { NextResponse } from "next/server";

import {
  describeIdempotencyError,
  idempotencyResponseHeaders,
  readIdempotencyKey,
  runIdempotentSerializableTransaction,
} from "@/lib/idempotency";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { subscriptionReplacementSchema } from "@/lib/schemas/subscription-lifecycle";
import { replaceSubscription } from "@/modules/sales/subscription-replacement-service";
import { getTenantProductContext } from "@/platform/product/product-context";

export const runtime = "nodejs";

const errorMessages: Record<string, { status: number; error: string }> = {
  SUBSCRIPTION_NOT_FOUND: { status: 404, error: "Abonnement introuvable" },
  SUBSCRIPTION_ALREADY_CANCELLED: { status: 409, error: "Cet abonnement est déjà résilié" },
  SUBSCRIPTION_ALREADY_REPLACED: { status: 409, error: "Cet abonnement possède déjà un remplacement" },
  SUBSCRIPTION_NOT_REPLACEABLE: { status: 409, error: "Cet abonnement n'est plus remplaçable. Utilisez une correction financière traçable." },
  SUBSCRIPTION_HAS_QUEUED_RENEWAL: { status: 409, error: "Annulez d'abord le renouvellement déjà planifié avant de remplacer cet abonnement." },
  REPLACEMENT_CANNOT_BE_FUTURE: { status: 409, error: "Une correction par remplacement doit prendre effet maintenant ou dans le passé" },
  TRANSFER_EXCEEDS_AVAILABLE_CREDIT: { status: 409, error: "Le crédit à transférer dépasse le total payé" },
  TRANSFER_EXCEEDS_REPLACEMENT_AMOUNT: { status: 409, error: "Le crédit dépasse le prix de la nouvelle formule. Corrigez ou remboursez d'abord la différence." },
  PARTIAL_TRANSFER_NOT_SUPPORTED: { status: 409, error: "Le remplacement transfère la totalité du crédit payé afin de conserver des reçus cohérents." },
  REPLACEMENT_OVERLAP_CONFLICT: { status: 409, error: "Un autre abonnement actif couvre déjà l'un des droits de cette formule." },
  REPLACEMENT_CANNOT_CARRY_OVER: { status: 409, error: "Un remplacement ne peut pas reporter des séances d'un autre abonnement." },
  GROUP_NOT_FOUND: { status: 404, error: "Un groupe sélectionné est introuvable" },
  GROUP_PLAN_MISMATCH: { status: 409, error: "Un groupe sélectionné ne correspond pas aux droits de la nouvelle formule" },
  CLASS_GROUP_REQUIRED: { status: 409, error: "Choisissez un groupe pour chaque discipline de la nouvelle formule" },
  GROUP_CAPACITY_REACHED: { status: 409, error: "Un groupe sélectionné est complet" },
  GROUP_SCHEDULE_CONFLICT: { status: 409, error: "Le groupe sélectionné crée un conflit d'horaire pour ce membre" },
  OVERPAY: { status: 409, error: "Le transfert dépasserait le montant de la nouvelle formule" },
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let actor;
  try {
    actor = await requirePermission(request, "subscriptions.correct");
  } catch (error) {
    return jsonAuthFailureResponse(error);
  }
  const { id } = await context.params;
  const parsed = subscriptionReplacementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation échouée", details: parsed.error.flatten() }, { status: 400 });
  }

  const plan = await prisma.subscriptionPlan.findFirst({
    where: { tenantId: actor.tenantId, id: parsed.data.planId, isActive: true },
    include: { entitlements: { select: { type: true, sportId: true } } },
  });
  if (!plan) return NextResponse.json({ error: "Formule introuvable ou inactive" }, { status: 404 });
  const product = await getTenantProductContext(actor.tenantId);
  const enabled = plan.planKind === "CLASS"
    ? product.capabilities.classManagement
    : plan.planKind === "GYM"
      ? product.capabilities.gymAccess
      : product.capabilities.mixedSales;
  if (!enabled) return NextResponse.json({ error: "Ce type de formule n'est pas actif pour ce club" }, { status: 403 });

  try {
    const outcome = await runIdempotentSerializableTransaction(
      {
        tenantId: actor.tenantId,
        scope: "subscriptions:replace",
        idempotencyKey: readIdempotencyKey(request),
        requestPayload: { subscriptionId: id, ...parsed.data },
      },
      async (tx) => ({
        status: 201,
        body: {
          data: await replaceSubscription(tx, {
            tenantId: actor.tenantId,
            actorId: actor.id,
            subscriptionId: id,
            plan,
            startDate: new Date(parsed.data.startDate),
            transferCents: parsed.data.transferCents,
            groupIds: parsed.data.groupIds,
            reason: parsed.data.reason,
          }),
        },
      }),
    );
    return NextResponse.json(outcome.response.body, {
      status: outcome.response.status,
      headers: idempotencyResponseHeaders(outcome.replayed),
    });
  } catch (error) {
    const idempotency = describeIdempotencyError(error);
    if (idempotency) return NextResponse.json(idempotency, { status: idempotency.status });
    const mapped = error instanceof Error ? errorMessages[error.message] : null;
    if (mapped) return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    console.error("[POST subscription replacement]", error);
    return NextResponse.json({ error: "Remplacement impossible" }, { status: 500 });
  }
}
