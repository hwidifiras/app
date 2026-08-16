import { normalizeHost, resolveTenantHostConfig } from "@/lib/tenant-host";
import { resolveSaasSignupConfig } from "@/platform/signup/signup-config";
import { SignupServiceError } from "@/platform/signup/signup-errors";

type FetchLike = typeof fetch;

type AntiBotResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  score?: number;
};

const VERIFY_ENDPOINTS = {
  TURNSTILE: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  RECAPTCHA: "https://www.google.com/recaptcha/api/siteverify",
} as const;

function configuredPlatformHost(): string {
  const platformUrl = process.env.PLATFORM_APP_URL?.trim();
  if (platformUrl) {
    try {
      return normalizeHost(new URL(platformUrl).host);
    } catch {
      return normalizeHost(platformUrl);
    }
  }
  return Array.from(resolveTenantHostConfig().platformHosts)[0] ?? "";
}
function recaptchaMinimumScore(): number {
  const parsed = Number(process.env.SIGNUP_RECAPTCHA_MIN_SCORE ?? "0.5");
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.5;
}

export async function verifySignupAntiBot(input: {
  token?: string;
  remoteIp?: string;
  fetchImpl?: FetchLike;
}): Promise<void> {
  const config = resolveSaasSignupConfig();
  if (config.antiBotProvider === "NONE") {
    if (config.mode === "PUBLIC") throw new SignupServiceError("ANTI_BOT_REQUIRED", 503);
    return;
  }

  const token = input.token?.trim();
  if (!token) throw new SignupServiceError("ANTI_BOT_REQUIRED", 400);

  const secret = process.env.SIGNUP_ANTI_BOT_SECRET?.trim();
  if (!secret) throw new SignupServiceError("ANTI_BOT_UNAVAILABLE", 503);

  const body = new URLSearchParams({ secret, response: token });
  if (input.remoteIp && input.remoteIp !== "unknown") body.set("remoteip", input.remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await (input.fetchImpl ?? fetch)(VERIFY_ENDPOINTS[config.antiBotProvider], {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new SignupServiceError("ANTI_BOT_UNAVAILABLE", 503);

    const result = (await response.json()) as AntiBotResponse;
    const expectedAction = process.env.SIGNUP_ANTI_BOT_ACTION?.trim() || "workspace_signup";
    const expectedHost = configuredPlatformHost();
    const hostnameMatches = !expectedHost || normalizeHost(result.hostname) === expectedHost;
    const actionMatches = !expectedAction || result.action === expectedAction;
    const scoreMatches =
      config.antiBotProvider !== "RECAPTCHA"
      || (typeof result.score === "number" && result.score >= recaptchaMinimumScore());

    if (!result.success || !hostnameMatches || !actionMatches || !scoreMatches) {
      throw new SignupServiceError("ANTI_BOT_FAILED", 400);
    }
  } catch (error) {
    if (error instanceof SignupServiceError) throw error;
    throw new SignupServiceError("ANTI_BOT_UNAVAILABLE", 503);
  } finally {
    clearTimeout(timeout);
  }
}
