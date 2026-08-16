export const SAAS_SIGNUP_MODES = ["DISABLED", "INVITE_ONLY", "PUBLIC"] as const;
export type SaasSignupMode = (typeof SAAS_SIGNUP_MODES)[number];

export const SIGNUP_ANTI_BOT_PROVIDERS = ["NONE", "TURNSTILE", "RECAPTCHA"] as const;
export type SignupAntiBotProvider = (typeof SIGNUP_ANTI_BOT_PROVIDERS)[number];

export type SaasSignupConfig = {
  mode: SaasSignupMode;
  trialDays: number;
  antiBotProvider: SignupAntiBotProvider;
  antiBotSiteKey: string | null;
  antiBotSecretConfigured: boolean;
  termsUrl: string | null;
  privacyUrl: string | null;
};

type Environment = Record<string, string | undefined>;

function enumValue<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  const normalized = value?.trim().toUpperCase();
  return allowed.includes(normalized as T) ? (normalized as T) : fallback;
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function resolveSaasSignupConfig(env: Environment = process.env): SaasSignupConfig {
  return {
    mode: enumValue(env.SAAS_SIGNUP_MODE, SAAS_SIGNUP_MODES, "DISABLED"),
    trialDays: boundedInteger(env.SAAS_SIGNUP_TRIAL_DAYS, 14, 1, 90),
    antiBotProvider: enumValue(
      env.NEXT_PUBLIC_SIGNUP_ANTI_BOT_PROVIDER,
      SIGNUP_ANTI_BOT_PROVIDERS,
      "NONE",
    ),
    antiBotSiteKey: env.NEXT_PUBLIC_SIGNUP_ANTI_BOT_SITE_KEY?.trim() || null,
    antiBotSecretConfigured: Boolean(env.SIGNUP_ANTI_BOT_SECRET?.trim()),
    termsUrl: env.SAAS_TERMS_URL?.trim() || null,
    privacyUrl: env.SAAS_PRIVACY_URL?.trim() || null,
  };
}

export function isSaasSignupEnabled(config = resolveSaasSignupConfig()): boolean {
  return config.mode !== "DISABLED";
}
