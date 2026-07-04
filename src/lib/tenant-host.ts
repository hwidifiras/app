export const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG?.trim() || "we-discipline";
export const SAAS_ROOT_DOMAIN = process.env.SAAS_ROOT_DOMAIN?.trim().toLowerCase() || "localhost";

export function normalizeHost(value: string | null | undefined): string {
  const host = (value ?? "").trim().toLowerCase();
  if (!host) return "";
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end === -1 ? host : host.slice(1, end);
  }
  return host.split(":")[0] ?? host;
}

export function tenantSlugFromHost(hostValue: string | null | undefined): string | null {
  const host = normalizeHost(hostValue);
  if (!host) return null;

  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return DEFAULT_TENANT_SLUG;
  }

  if (host === SAAS_ROOT_DOMAIN) {
    return DEFAULT_TENANT_SLUG;
  }

  const suffix = `.${SAAS_ROOT_DOMAIN}`;
  if (host.endsWith(suffix)) {
    const subdomain = host.slice(0, -suffix.length);
    return subdomain && !subdomain.includes(".") ? subdomain : null;
  }

  return null;
}
