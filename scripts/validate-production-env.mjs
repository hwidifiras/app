import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), false);

const errors = [];
const placeholderValues = new Set([
  "change-me",
  "change-me-in-production",
  "changeme",
  "gymday",
  "password",
  "postgres",
  "replace-me",
  "replace-with-a-long-random-secret",
  "replace-with-strong-password",
  "secret",
]);

function value(name) {
  return process.env[name]?.trim() ?? "";
}

function normalized(input) {
  return input.trim().toLowerCase().replace(/^['"]|['"]$/g, "");
}

function isPlaceholder(input) {
  const candidate = normalized(input);
  return (
    placeholderValues.has(candidate) ||
    candidate.includes("your-domain") ||
    candidate.includes("xxxxxxxxx") ||
    candidate === "example.com" ||
    candidate.endsWith(".example.com") ||
    candidate.endsWith(".example") ||
    candidate.endsWith(".test") ||
    candidate.startsWith("replace-")
  );
}

function requireValue(name) {
  const candidate = value(name);
  if (!candidate) errors.push(`${name} is required.`);
  return candidate;
}

const postgresUser = value("POSTGRES_USER");
const postgresPassword = value("POSTGRES_PASSWORD");
const postgresDatabase = value("POSTGRES_DB");
const databaseUrlValue =
  value("DATABASE_URL") ||
  (postgresUser && postgresPassword && postgresDatabase
    ? `postgresql://${encodeURIComponent(postgresUser)}:${encodeURIComponent(postgresPassword)}@postgres:5432/${encodeURIComponent(postgresDatabase)}?schema=public`
    : "");

if (!databaseUrlValue) {
  errors.push(
    "DATABASE_URL is required, or set POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB for Docker Compose.",
  );
}

if (databaseUrlValue) {
  try {
    const databaseUrl = new URL(databaseUrlValue);
    if (!databaseUrl.protocol.startsWith("postgres")) {
      errors.push("DATABASE_URL must use PostgreSQL (postgresql:// or postgres://).");
    }
    if (!databaseUrl.hostname) errors.push("DATABASE_URL must include a database host.");
    if (!databaseUrl.pathname || databaseUrl.pathname === "/") {
      errors.push("DATABASE_URL must include a database name.");
    }
    if (!databaseUrl.username) errors.push("DATABASE_URL must include a database user.");
    if (!databaseUrl.password) {
      errors.push("DATABASE_URL must include a database password.");
    } else if (isPlaceholder(decodeURIComponent(databaseUrl.password))) {
      errors.push("DATABASE_URL contains a default or placeholder database password.");
    }
  } catch {
    errors.push("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
}

if (postgresPassword) {
  if (isPlaceholder(postgresPassword)) {
    errors.push("POSTGRES_PASSWORD must not use a default or placeholder value.");
  } else if (postgresPassword.length < 16) {
    errors.push("POSTGRES_PASSWORD must contain at least 16 characters.");
  }
}

const authSecret = requireValue("AUTH_SECRET");
if (authSecret) {
  if (isPlaceholder(authSecret)) {
    errors.push("AUTH_SECRET must not use a default or placeholder value.");
  } else if (authSecret.length < 32) {
    errors.push("AUTH_SECRET must contain at least 32 characters.");
  }
}

const appUrlValue = requireValue("APP_URL");
if (appUrlValue) {
  try {
    const appUrl = new URL(appUrlValue);
    if (appUrl.protocol !== "https:") {
      errors.push("APP_URL must use https:// in production.");
    }
    if (isPlaceholder(appUrl.hostname)) {
      errors.push("APP_URL must use the real public hostname.");
    }
  } catch {
    errors.push("APP_URL must be a valid absolute URL.");
  }
}

const rootDomain = requireValue("SAAS_ROOT_DOMAIN").toLowerCase();
if (
  rootDomain === "localhost" ||
  rootDomain.endsWith(".localhost") ||
  isPlaceholder(rootDomain)
) {
  errors.push("SAAS_ROOT_DOMAIN must use the production SaaS domain.");
}

const tenantSlug = requireValue("DEFAULT_TENANT_SLUG");
if (tenantSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantSlug)) {
  errors.push("DEFAULT_TENANT_SLUG must be a lowercase DNS-safe slug.");
}

const signupMode = (value("SAAS_SIGNUP_MODE") || "DISABLED").toUpperCase();
if (!["DISABLED", "INVITE_ONLY", "PUBLIC"].includes(signupMode)) {
  errors.push("SAAS_SIGNUP_MODE must be DISABLED, INVITE_ONLY, or PUBLIC.");
}
const signupEnabled = signupMode === "INVITE_ONLY" || signupMode === "PUBLIC";
const signupTrialDays = Number.parseInt(value("SAAS_SIGNUP_TRIAL_DAYS") || "14", 10);
if (!Number.isInteger(signupTrialDays) || signupTrialDays < 1 || signupTrialDays > 90) {
  errors.push("SAAS_SIGNUP_TRIAL_DAYS must be an integer from 1 to 90.");
}
const signupTokenSecret = value("SIGNUP_TOKEN_SECRET");
if (signupEnabled) {
  if (!signupTokenSecret || isPlaceholder(signupTokenSecret)) {
    errors.push("SIGNUP_TOKEN_SECRET is required and must not be a placeholder when SaaS owner signup is enabled.");
  } else if (signupTokenSecret.length < 32) {
    errors.push("SIGNUP_TOKEN_SECRET must contain at least 32 characters.");
  } else if (signupTokenSecret === authSecret) {
    errors.push("SIGNUP_TOKEN_SECRET must be different from AUTH_SECRET.");
  }
}

for (const legalUrlName of ["SAAS_TERMS_URL", "SAAS_PRIVACY_URL"]) {
  const legalUrlValue = value(legalUrlName);
  if (signupEnabled && !legalUrlValue) {
    errors.push(`${legalUrlName} is required when SaaS owner signup is enabled.`);
    continue;
  }
  if (legalUrlValue) {
    try {
      const legalUrl = new URL(legalUrlValue);
      if (legalUrl.protocol !== "https:") errors.push(`${legalUrlName} must use https:// in production.`);
    } catch {
      errors.push(`${legalUrlName} must be a valid absolute URL.`);
    }
  }
}

const platformAppUrlValue = value("PLATFORM_APP_URL");
if (signupEnabled && !platformAppUrlValue) {
  errors.push("PLATFORM_APP_URL is required when SaaS owner signup is enabled.");
}
if (platformAppUrlValue) {
  try {
    const platformAppUrl = new URL(platformAppUrlValue);
    if (platformAppUrl.protocol !== "https:") {
      errors.push("PLATFORM_APP_URL must use https:// in production.");
    }
    if (isPlaceholder(platformAppUrl.hostname)) {
      errors.push("PLATFORM_APP_URL must use the real public platform hostname.");
    }
    if (platformAppUrl.hostname === rootDomain) {
      errors.push("PLATFORM_APP_URL must use a dedicated hostname, not the tenant root domain.");
    }
    if (!platformAppUrl.hostname.endsWith(`.${rootDomain}`)) {
      errors.push("PLATFORM_APP_URL must be a hostname below SAAS_ROOT_DOMAIN.");
    }
  } catch {
    errors.push("PLATFORM_APP_URL must be a valid absolute URL.");
  }
}

const rateLimitUrlValue =
  value("RATE_LIMIT_REDIS_REST_URL") || value("UPSTASH_REDIS_REST_URL");
const rateLimitToken =
  value("RATE_LIMIT_REDIS_REST_TOKEN") || value("UPSTASH_REDIS_REST_TOKEN");
const rateLimitBackend = value("RATE_LIMIT_BACKEND").toLowerCase();
if (rateLimitBackend && !["memory", "redis"].includes(rateLimitBackend)) {
  errors.push("RATE_LIMIT_BACKEND must be either memory or redis.");
}

const accessCredentialSecret = value("ACCESS_CREDENTIAL_SECRET");
if (accessCredentialSecret) {
  if (isPlaceholder(accessCredentialSecret)) {
    errors.push("ACCESS_CREDENTIAL_SECRET must not use a default or placeholder value.");
  } else if (accessCredentialSecret.length < 32) {
    errors.push("ACCESS_CREDENTIAL_SECRET must contain at least 32 characters.");
  } else if (accessCredentialSecret === authSecret) {
    errors.push("ACCESS_CREDENTIAL_SECRET should be different from AUTH_SECRET.");
  }
}
const usesSingleInstanceMemoryRateLimit = rateLimitBackend === "memory";

if (!rateLimitUrlValue && !usesSingleInstanceMemoryRateLimit) {
  errors.push(
    "RATE_LIMIT_REDIS_REST_URL is required unless RATE_LIMIT_BACKEND=memory is explicitly selected for one app replica.",
  );
} else if (rateLimitUrlValue) {
  try {
    const rateLimitUrl = new URL(rateLimitUrlValue);
    if (rateLimitUrl.protocol !== "https:") {
      errors.push("RATE_LIMIT_REDIS_REST_URL must use https:// in production.");
    }
  } catch {
    errors.push("RATE_LIMIT_REDIS_REST_URL must be a valid absolute URL.");
  }
}
if ((!rateLimitToken || isPlaceholder(rateLimitToken)) && !usesSingleInstanceMemoryRateLimit) {
  errors.push("RATE_LIMIT_REDIS_REST_TOKEN is required and must not be a placeholder.");
}
if (signupMode === "PUBLIC" && usesSingleInstanceMemoryRateLimit) {
  errors.push("Public SaaS signup requires the shared Redis rate-limit backend.");
}

const trustedProxyHops = Number.parseInt(value("TRUSTED_PROXY_HOPS"), 10);
if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 1 || trustedProxyHops > 10) {
  errors.push("TRUSTED_PROXY_HOPS must be an integer from 1 to 10.");
}

const resendApiKey = value("RESEND_API_KEY");
const passwordResetFrom = value("PASSWORD_RESET_FROM");
const signupFrom = value("SAAS_SIGNUP_FROM") || passwordResetFrom;
if (resendApiKey || passwordResetFrom) {
  if (!resendApiKey || isPlaceholder(resendApiKey)) {
    errors.push("RESEND_API_KEY must be configured when password reset email is enabled.");
  }
  if (!passwordResetFrom || isPlaceholder(passwordResetFrom)) {
    errors.push("PASSWORD_RESET_FROM must be configured when password reset email is enabled.");
  }
}
if (signupEnabled) {
  if (!resendApiKey || isPlaceholder(resendApiKey)) {
    errors.push("RESEND_API_KEY is required when SaaS owner signup is enabled.");
  }
  if (!signupFrom || isPlaceholder(signupFrom)) {
    errors.push("SAAS_SIGNUP_FROM or PASSWORD_RESET_FROM is required when SaaS owner signup is enabled.");
  }
}

const antiBotProvider = (value("NEXT_PUBLIC_SIGNUP_ANTI_BOT_PROVIDER") || "NONE").toUpperCase();
if (!["NONE", "TURNSTILE", "RECAPTCHA"].includes(antiBotProvider)) {
  errors.push("NEXT_PUBLIC_SIGNUP_ANTI_BOT_PROVIDER must be NONE, TURNSTILE, or RECAPTCHA.");
}
if (signupMode === "PUBLIC" && antiBotProvider === "NONE") {
  errors.push("Public SaaS signup requires TURNSTILE or RECAPTCHA bot protection.");
}
if (antiBotProvider !== "NONE") {
  if (!value("NEXT_PUBLIC_SIGNUP_ANTI_BOT_SITE_KEY")) {
    errors.push("NEXT_PUBLIC_SIGNUP_ANTI_BOT_SITE_KEY is required for the selected bot provider.");
  }
  const antiBotSecret = value("SIGNUP_ANTI_BOT_SECRET");
  if (!antiBotSecret || isPlaceholder(antiBotSecret)) {
    errors.push("SIGNUP_ANTI_BOT_SECRET is required and must not be a placeholder for the selected bot provider.");
  }
}
const recaptchaMinimumScore = Number(value("SIGNUP_RECAPTCHA_MIN_SCORE") || "0.5");
if (!Number.isFinite(recaptchaMinimumScore) || recaptchaMinimumScore < 0 || recaptchaMinimumScore > 1) {
  errors.push("SIGNUP_RECAPTCHA_MIN_SCORE must be a number from 0 to 1.");
}

if (errors.length > 0) {
  console.error("Production configuration is invalid:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

if (usesSingleInstanceMemoryRateLimit) {
  console.warn(
    "Production rate limiting uses bounded process memory. Run exactly one app replica or configure REST Redis before scaling.",
  );
}

console.log("Production configuration is valid.");
