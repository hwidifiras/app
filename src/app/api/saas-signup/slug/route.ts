import { workspaceSlugAvailability } from "@/platform/signup/signup-account-service";
import { noStoreJson, signupErrorResponse } from "@/platform/signup/signup-api";
import { SignupServiceError } from "@/platform/signup/signup-errors";
import { requirePlatformRequest } from "@/platform/signup/platform-request";
import { readSignupSession } from "@/platform/signup/signup-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requirePlatformRequest(request);
    const session = await readSignupSession();
    if (!session || session.stage !== "VERIFIED") {
      throw new SignupServiceError("SIGNUP_NOT_VERIFIED", 403);
    }
    const value = new URL(request.url).searchParams.get("value") ?? "";
    return noStoreJson({ data: await workspaceSlugAvailability(value) });
  } catch (error) {
    return signupErrorResponse(error);
  }
}
