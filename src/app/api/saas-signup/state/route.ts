import { getWorkspaceSignupState } from "@/platform/signup/signup-account-service";
import { noStoreJson, serializeSignupState, signupErrorResponse } from "@/platform/signup/signup-api";
import { SignupServiceError } from "@/platform/signup/signup-errors";
import { requirePlatformRequest } from "@/platform/signup/platform-request";
import { readSignupSession } from "@/platform/signup/signup-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requirePlatformRequest(request);
    const session = await readSignupSession();
    if (!session) throw new SignupServiceError("SIGNUP_SESSION_INVALID", 401);
    const state = await getWorkspaceSignupState(session.signupId);
    return noStoreJson({ data: { signup: serializeSignupState(state) } });
  } catch (error) {
    return signupErrorResponse(error);
  }
}
