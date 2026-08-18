import { normalizeHost } from "@/lib/tenant-host";

type Environment = Record<string, string | undefined>;

const DEFAULT_DEMO_ACCOUNT_EMAIL = "demo@we-discipline.test";

function normalizedSlug(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function configuredDemoTenantSlugs(
  env: Environment = process.env,
): ReadonlySet<string> {
  return new Set(
    (env.SAAS_DEMO_TENANT_SLUGS ?? "")
      .split(",")
      .map(normalizedSlug)
      .filter(Boolean),
  );
}

export function isDemoTenantSlug(
  tenantSlug: string | null | undefined,
  env: Environment = process.env,
): boolean {
  const slug = normalizedSlug(tenantSlug);
  return Boolean(slug && configuredDemoTenantSlugs(env).has(slug));
}

export function demoAccountEmail(env: Environment = process.env): string {
  return (env.SAAS_DEMO_ACCOUNT_EMAIL ?? DEFAULT_DEMO_ACCOUNT_EMAIL)
    .trim()
    .toLowerCase();
}

export function demoWorkspaceEntryUrl(env: Environment = process.env): string | null {
  const configured = env.SAAS_DEMO_WORKSPACE_URL?.trim();
  if (!configured) return null;

  try {
    const workspace = new URL(configured);
    if (workspace.protocol !== "https:" && workspace.protocol !== "http:") return null;
    workspace.pathname = "/api/auth/demo";
    workspace.search = "?next=%2F";
    workspace.hash = "";
    return workspace.toString();
  } catch {
    return null;
  }
}

export function safeDemoNextPath(value: string | null | undefined): string {
  const candidate = (value ?? "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return "/";

  try {
    const parsed = new URL(candidate, "https://demo.invalid");
    if (parsed.origin !== "https://demo.invalid") return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function isDemoMutationAllowed(pathname: string): boolean {
  return (
    pathname === "/api/auth/demo" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout"
  );
}

export function demoPublicRequestOrigin(input: {
  requestUrl: string;
  hostHeader?: string | null;
  forwardedHostHeader?: string | null;
  forwardedProtocolHeader?: string | null;
  resolvedHost: string;
}): string {
  const requestUrl = new URL(input.requestUrl);
  const forwardedHost = input.forwardedHostHeader?.split(",")[0]?.trim();
  const hostHeader = input.hostHeader?.trim();
  const publicHost = forwardedHost || hostHeader || requestUrl.host;

  if (normalizeHost(publicHost) !== input.resolvedHost) return requestUrl.origin;

  const forwardedProtocol = input.forwardedProtocolHeader
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : requestUrl.protocol.replace(":", "");

  try {
    return new URL(`${protocol}://${publicHost}`).origin;
  } catch {
    return requestUrl.origin;
  }
}
