import { afterEach, describe, expect, it, vi } from "vitest";

import { productModulesForEdition, saasPlanCodeForEdition } from "@/platform/billing/edition-plan";
import { verifySignupAntiBot } from "@/platform/signup/signup-anti-bot";
import { buildSignupVerificationEmail, signupVerificationUrl } from "@/platform/signup/signup-email";
import { SignupServiceError } from "@/platform/signup/signup-errors";
import { requirePlatformRequest, requireTrustedMutationOrigin } from "@/platform/signup/platform-request";
import { signupProvisionSchema, signupStartSchema, signupVerifySchema } from "@/platform/signup/signup-schemas";
import {
  createSignupVerificationSecrets,
  createWorkspaceHandoffSecret,
  hashSignupVerificationCode,
  hashWorkspaceHandoffToken,
} from "@/platform/signup/signup-security";
import { signSignupSession, verifySignupSession } from "@/platform/signup/signup-session";

const SIGNUP_SECRET = "signup-secret-that-is-longer-than-thirty-two-characters";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("signup secrets and sessions", () => {
  it("stores only deterministic, namespace-bound hashes", () => {
    vi.stubEnv("SIGNUP_TOKEN_SECRET", SIGNUP_SECRET);
    const verification = createSignupVerificationSecrets("signup-1");
    expect(verification.code).toMatch(/^\d{6}$/);
    expect(verification.token).not.toBe(verification.tokenHash);
    expect(hashSignupVerificationCode("signup-1", verification.code)).toBe(verification.codeHash);

    const handoff = createWorkspaceHandoffSecret("tenant-1", "user-1");
    expect(hashWorkspaceHandoffToken("tenant-1", "user-1", handoff.token)).toBe(handoff.tokenHash);
    expect(hashWorkspaceHandoffToken("tenant-2", "user-1", handoff.token)).not.toBe(handoff.tokenHash);
  });

  it("signs a short-lived signup session with an explicit stage", async () => {
    vi.stubEnv("SIGNUP_TOKEN_SECRET", SIGNUP_SECRET);
    const token = await signSignupSession({ signupId: "signup-1", stage: "PENDING_EMAIL" });
    await expect(verifySignupSession(token)).resolves.toEqual({
      signupId: "signup-1",
      stage: "PENDING_EMAIL",
    });
    await expect(verifySignupSession(`${token}changed`)).resolves.toBeNull();
  });
});

describe("signup request boundaries", () => {
  it("accepts the platform host and rejects a tenant host", () => {
    vi.stubEnv("SAAS_ROOT_DOMAIN", "we-discipline.com");
    vi.stubEnv("PLATFORM_APP_URL", "https://app.we-discipline.com");
    expect(requirePlatformRequest(new Request("https://app.we-discipline.com/signup"))).toBe(
      "app.we-discipline.com",
    );
    expect(() => requirePlatformRequest(new Request("https://dojo.we-discipline.com/signup"))).toThrowError(
      expect.objectContaining({ code: "PLATFORM_HOST_REQUIRED" }),
    );
  });

  it("accepts only the platform origin for browser mutations", () => {
    vi.stubEnv("SAAS_ROOT_DOMAIN", "we-discipline.com");
    vi.stubEnv("PLATFORM_APP_URL", "https://app.we-discipline.com");
    expect(() => requireTrustedMutationOrigin(new Request("https://app.we-discipline.com/api/saas-signup/start", {
      method: "POST",
      headers: { origin: "https://app.we-discipline.com" },
    }))).not.toThrow();
    expect(() => requireTrustedMutationOrigin(new Request("https://app.we-discipline.com/api/saas-signup/start", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    }))).toThrowError(SignupServiceError);
  });
});

describe("anti-bot provider adapter", () => {
  it("accepts a matching Turnstile response", async () => {
    vi.stubEnv("SAAS_SIGNUP_MODE", "PUBLIC");
    vi.stubEnv("NEXT_PUBLIC_SIGNUP_ANTI_BOT_PROVIDER", "TURNSTILE");
    vi.stubEnv("SIGNUP_ANTI_BOT_SECRET", "provider-secret");
    vi.stubEnv("SIGNUP_ANTI_BOT_ACTION", "workspace_signup");
    vi.stubEnv("PLATFORM_APP_URL", "https://app.we-discipline.com");
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      hostname: "app.we-discipline.com",
      action: "workspace_signup",
    }), { status: 200 })) as unknown as typeof fetch;

    await expect(verifySignupAntiBot({ token: "browser-token", fetchImpl })).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects a low-score reCAPTCHA response", async () => {
    vi.stubEnv("SAAS_SIGNUP_MODE", "PUBLIC");
    vi.stubEnv("NEXT_PUBLIC_SIGNUP_ANTI_BOT_PROVIDER", "RECAPTCHA");
    vi.stubEnv("SIGNUP_ANTI_BOT_SECRET", "provider-secret");
    vi.stubEnv("SIGNUP_RECAPTCHA_MIN_SCORE", "0.7");
    vi.stubEnv("PLATFORM_APP_URL", "https://app.we-discipline.com");
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      hostname: "app.we-discipline.com",
      action: "workspace_signup",
      score: 0.4,
    }), { status: 200 })) as unknown as typeof fetch;

    await expect(verifySignupAntiBot({ token: "browser-token", fetchImpl })).rejects.toMatchObject({
      code: "ANTI_BOT_FAILED",
    });
  });
});

describe("signup contracts", () => {
  it("requires a strong-enough password and explicit terms acceptance", () => {
    expect(signupStartSchema.safeParse({
      ownerName: "Firas",
      email: "firas@example.com",
      password: "short",
      termsAccepted: false,
    }).success).toBe(false);
    expect(signupStartSchema.safeParse({
      ownerName: "Firas",
      email: "firas@example.com",
      password: "motdepasse2026",
      termsAccepted: true,
    }).success).toBe(true);
  });

  it("allows link verification without a cookie and validates activity templates", () => {
    expect(signupVerifySchema.safeParse({ signupId: "signup-id-123", token: "x".repeat(32) }).success).toBe(true);
    expect(signupProvisionSchema.safeParse({
      clubName: "Dojo Tunis",
      slug: "dojo-tunis",
      edition: "CLASS",
      activityTemplateKeys: ["martial-arts-dojo"],
    }).success).toBe(true);
    expect(signupProvisionSchema.safeParse({
      clubName: "Dojo Tunis",
      slug: "dojo-tunis",
      edition: "CLASS",
      activityTemplateKeys: ["unknown-template"],
    }).success).toBe(false);
  });

  it("maps editions to server-trusted plans and modules", () => {
    expect(saasPlanCodeForEdition("CLASS")).toBe("CLASS");
    expect(productModulesForEdition("GYM")).toEqual(["GYM_ACCESS"]);
    expect(productModulesForEdition("HYBRID")).toEqual(["CLASS_MANAGEMENT", "GYM_ACCESS"]);
  });

  it("builds an escaped, platform-hosted verification email", () => {
    const url = signupVerificationUrl({
      signupId: "signup-1",
      token: "secret-token",
      platformUrl: "https://app.we-discipline.com",
    });
    expect(url).toBe("https://app.we-discipline.com/signup/verify?signup=signup-1&token=secret-token");
    const email = buildSignupVerificationEmail({
      ownerName: "<Admin>",
      code: "123456",
      verificationUrl: url,
    });
    expect(email.html).toContain("&lt;Admin&gt;");
    expect(email.html).not.toContain("<Admin>");
    expect(email.text).toContain("123456");
  });
});
