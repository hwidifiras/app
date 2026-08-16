import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/request-user";
import { onboardingMutationSchema } from "@/platform/onboarding/onboarding-schemas";
import {
  getTenantOnboardingState,
  mutateTenantOnboarding,
  TenantOnboardingError,
} from "@/platform/onboarding/tenant-onboarding-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authError(error: unknown) {
  const code = error instanceof Error ? error.message : "FORBIDDEN";
  return NextResponse.json(
    { error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé" },
    { status: code === "UNAUTHENTICATED" ? 401 : 403 },
  );
}

function serviceError(error: unknown) {
  if (error instanceof TenantOnboardingError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Tenant onboarding failed", error);
  return NextResponse.json({ error: "Le parcours de démarrage n'a pas pu être enregistré." }, { status: 500 });
}

export async function GET(request: Request) {
  let actor;
  try {
    actor = await requireAdmin(request);
  } catch (error) {
    return authError(error);
  }

  try {
    return NextResponse.json({ data: await getTenantOnboardingState(actor.tenantId) });
  } catch (error) {
    return serviceError(error);
  }
}

export async function PATCH(request: Request) {
  let actor;
  try {
    actor = await requireAdmin(request);
  } catch (error) {
    return authError(error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }
  const parsed = onboardingMutationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Vérifiez les informations saisies.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const state = await mutateTenantOnboarding(actor.tenantId, actor.id, parsed.data);
    return NextResponse.json({ data: state });
  } catch (error) {
    return serviceError(error);
  }
}
