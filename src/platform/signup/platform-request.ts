import { isPlatformHost, normalizeHost } from "@/lib/tenant-host";
import { SignupServiceError } from "@/platform/signup/signup-errors";

export function requestHost(request: Request): string {
  return normalizeHost(
    request.headers.get("x-forwarded-host")
      ?? request.headers.get("host")
      ?? new URL(request.url).host,
  );
}

export function requirePlatformRequest(request: Request): string {
  const host = requestHost(request);
  if (!isPlatformHost(host)) throw new SignupServiceError("PLATFORM_HOST_REQUIRED", 404);
  return host;
}

export function requireTrustedMutationOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    if (process.env.NODE_ENV === "production") throw new SignupServiceError("UNTRUSTED_ORIGIN", 403);
    return;
  }
  try {
    const parsed = new URL(origin);
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
      throw new SignupServiceError("UNTRUSTED_ORIGIN", 403);
    }
    if (!isPlatformHost(parsed.host)) throw new SignupServiceError("UNTRUSTED_ORIGIN", 403);
  } catch {
    throw new SignupServiceError("UNTRUSTED_ORIGIN", 403);
  }
}
