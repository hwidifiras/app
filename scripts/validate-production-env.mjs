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

const rateLimitUrlValue =
  value("RATE_LIMIT_REDIS_REST_URL") || value("UPSTASH_REDIS_REST_URL");
const rateLimitToken =
  value("RATE_LIMIT_REDIS_REST_TOKEN") || value("UPSTASH_REDIS_REST_TOKEN");
if (!rateLimitUrlValue) {
  errors.push("RATE_LIMIT_REDIS_REST_URL is required for shared production rate limiting.");
} else {
  try {
    const rateLimitUrl = new URL(rateLimitUrlValue);
    if (rateLimitUrl.protocol !== "https:") {
      errors.push("RATE_LIMIT_REDIS_REST_URL must use https:// in production.");
    }
  } catch {
    errors.push("RATE_LIMIT_REDIS_REST_URL must be a valid absolute URL.");
  }
}
if (!rateLimitToken || isPlaceholder(rateLimitToken)) {
  errors.push("RATE_LIMIT_REDIS_REST_TOKEN is required and must not be a placeholder.");
}

const trustedProxyHops = Number.parseInt(value("TRUSTED_PROXY_HOPS"), 10);
if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 1 || trustedProxyHops > 10) {
  errors.push("TRUSTED_PROXY_HOPS must be an integer from 1 to 10.");
}

const resendApiKey = value("RESEND_API_KEY");
const passwordResetFrom = value("PASSWORD_RESET_FROM");
if (resendApiKey || passwordResetFrom) {
  if (!resendApiKey || isPlaceholder(resendApiKey)) {
    errors.push("RESEND_API_KEY must be configured when password reset email is enabled.");
  }
  if (!passwordResetFrom || isPlaceholder(passwordResetFrom)) {
    errors.push("PASSWORD_RESET_FROM must be configured when password reset email is enabled.");
  }
}

if (errors.length > 0) {
  console.error("Production configuration is invalid:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Production configuration is valid.");
