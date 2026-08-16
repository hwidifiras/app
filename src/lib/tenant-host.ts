export const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG?.trim() || "we-discipline";
export const SAAS_ROOT_DOMAIN = process.env.SAAS_ROOT_DOMAIN?.trim().toLowerCase() || "localhost";

const DEFAULT_PLATFORM_SUBDOMAIN = "app";

export type TenantHostConfig = {
  defaultTenantSlug: string;
  rootDomain: string;
  platformHosts: ReadonlySet<string>;
};

type Environment = Record<string, string | undefined>;

export function normalizeHost(value: string | null | undefined): string {
  const host = (value ?? "").trim().toLowerCase();
  if (!host) return "";
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end === -1 ? host : host.slice(1, end);
  }
  return host.split(":")[0] ?? host;
}

function platformHostFromUrl(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    return normalizeHost(new URL(candidate).host);
  } catch {
    return normalizeHost(candidate);
  }
}

export function resolveTenantHostConfig(
  env: Environment = process.env,
): TenantHostConfig {
  const rootDomain = normalizeHost(env.SAAS_ROOT_DOMAIN) || "localhost";
  const defaultTenantSlug = env.DEFAULT_TENANT_SLUG?.trim() || "we-discipline";
  const configuredPlatformHost = platformHostFromUrl(env.PLATFORM_APP_URL);
  const platformAliases = (env.SAAS_PLATFORM_HOSTS ?? "")
    .split(",")
    .map(normalizeHost)
    .filter(Boolean);
  const defaultPlatformHost = `${DEFAULT_PLATFORM_SUBDOMAIN}.${rootDomain}`;

  return {
    defaultTenantSlug,
    rootDomain,
    platformHosts: new Set([
      configuredPlatformHost || defaultPlatformHost,
      ...platformAliases,
    ]),
  };
}

export function isPlatformHost(
  hostValue: string | null | undefined,
  config: TenantHostConfig = resolveTenantHostConfig(),
): boolean {
  const host = normalizeHost(hostValue);
  return Boolean(host && config.platformHosts.has(host));
}

export function tenantSlugFromHost(
  hostValue: string | null | undefined,
  config: TenantHostConfig = resolveTenantHostConfig(),
): string | null {
  const host = normalizeHost(hostValue);
  if (!host) return null;

  if (isPlatformHost(host, config)) return null;

  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return config.defaultTenantSlug;
  }

  if (host === config.rootDomain) {
    return config.defaultTenantSlug;
  }

  const suffix = `.${config.rootDomain}`;
  if (host.endsWith(suffix)) {
    const subdomain = host.slice(0, -suffix.length);
    return subdomain && !subdomain.includes(".") ? subdomain : null;
  }

  return null;
}
