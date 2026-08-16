import { getClientIp } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { noStoreJson, signupErrorResponse } from "@/platform/signup/signup-api";
import { requirePlatformRequest, requireTrustedMutationOrigin } from "@/platform/signup/platform-request";
import { enforceSignupRateLimit } from "@/platform/signup/signup-rate-limit";
import { workspaceLookupSchema } from "@/platform/signup/signup-schemas";
import { validateWorkspaceSlug, workspaceUrlForSlug } from "@/platform/signup/workspace-slug";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requirePlatformRequest(request);
    requireTrustedMutationOrigin(request);
    await enforceSignupRateLimit({
      namespace: "workspace-lookup",
      value: getClientIp(request),
      limit: 30,
      windowMs: 60 * 60 * 1_000,
    });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return noStoreJson({ error: "Données invalides." }, { status: 400 });
    }
    const parsed = workspaceLookupSchema.safeParse(body);
    const validation = parsed.success ? validateWorkspaceSlug(parsed.data.slug) : null;
    if (!validation?.valid) {
      return noStoreJson({ error: "Saisissez l'adresse de votre espace." }, { status: 400 });
    }
    const tenant = await prisma.tenant.findFirst({
      where: { slug: validation.slug, status: "ACTIVE" },
      select: { slug: true },
    });
    if (!tenant) {
      return noStoreJson({ error: "Aucun espace actif ne correspond à cette adresse." }, { status: 404 });
    }
    return noStoreJson({ data: { workspaceUrl: workspaceUrlForSlug(tenant.slug) } });
  } catch (error) {
    return signupErrorResponse(error);
  }
}
