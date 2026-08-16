import { getClientIp } from "@/lib/rate-limit";
import { verifyWorkspaceSignup } from "@/platform/signup/signup-account-service";
import { noStoreJson, serializeSignupState, signupErrorResponse } from "@/platform/signup/signup-api";
import { SignupServiceError } from "@/platform/signup/signup-errors";
import { requirePlatformRequest, requireTrustedMutationOrigin } from "@/platform/signup/platform-request";
import { enforceSignupRateLimit } from "@/platform/signup/signup-rate-limit";
import { signupVerifySchema } from "@/platform/signup/signup-schemas";
import { readSignupSession, setSignupSessionCookie } from "@/platform/signup/signup-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requirePlatformRequest(request);
    requireTrustedMutationOrigin(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return noStoreJson({ error: "Données invalides." }, { status: 400 });
    }
    const parsed = signupVerifySchema.safeParse(body);
    if (!parsed.success) {
      return noStoreJson({ error: "Saisissez le code reçu par email." }, { status: 400 });
    }

    const session = await readSignupSession();
    const signupId = session?.signupId ?? (parsed.data.token ? parsed.data.signupId : undefined);
    if (!signupId || (session && parsed.data.signupId && parsed.data.signupId !== session.signupId)) {
      throw new SignupServiceError("SIGNUP_SESSION_INVALID", 401);
    }
    await Promise.all([
      enforceSignupRateLimit({ namespace: "verify-ip", value: getClientIp(request), limit: 20, windowMs: 60 * 60 * 1_000 }),
      enforceSignupRateLimit({ namespace: "verify-signup", value: signupId, limit: 10, windowMs: 30 * 60 * 1_000 }),
    ]);
    const state = await verifyWorkspaceSignup({
      signupId,
      code: parsed.data.code,
      token: parsed.data.token,
    });
    await setSignupSessionCookie({ signupId, stage: "VERIFIED" });
    return noStoreJson({ data: { signup: serializeSignupState(state) } });
  } catch (error) {
    return signupErrorResponse(error);
  }
}
