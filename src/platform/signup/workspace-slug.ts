import { normalizeHost, resolveTenantHostConfig } from "@/lib/tenant-host";

const BUILT_IN_RESERVED_SLUGS = [
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "billing",
  "cdn",
  "demo",
  "help",
  "login",
  "mail",
  "root",
  "signup",
  "staging",
  "start",
  "status",
  "support",
  "www",
] as const;

type Environment = Record<string, string | undefined>;

export type WorkspaceSlugValidation =
  | { valid: true; slug: string }
  | { valid: false; slug: string; reason: "EMPTY" | "FORMAT" | "RESERVED" };

export function normalizeWorkspaceSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

export function reservedWorkspaceSlugs(env: Environment = process.env): ReadonlySet<string> {
  const hostConfig = resolveTenantHostConfig(env);
  const configured = (env.SAAS_RESERVED_SLUGS ?? "")
    .split(",")
    .map(normalizeWorkspaceSlug)
    .filter(Boolean);
  const platformLabels = Array.from(hostConfig.platformHosts)
    .map((host) => {
      const suffix = `.${hostConfig.rootDomain}`;
      return host.endsWith(suffix) ? host.slice(0, -suffix.length) : "";
    })
    .filter((label) => label && !label.includes("."));

  return new Set([...BUILT_IN_RESERVED_SLUGS, ...configured, ...platformLabels]);
}

export function validateWorkspaceSlug(
  value: string,
  env: Environment = process.env,
): WorkspaceSlugValidation {
  const slug = normalizeWorkspaceSlug(value);
  if (!slug) return { valid: false, slug, reason: "EMPTY" };
  if (slug.length < 3 || slug.length > 48 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { valid: false, slug, reason: "FORMAT" };
  }
  if (reservedWorkspaceSlugs(env).has(slug)) {
    return { valid: false, slug, reason: "RESERVED" };
  }
  return { valid: true, slug };
}

export function workspaceHostForSlug(slug: string, env: Environment = process.env): string {
  const validation = validateWorkspaceSlug(slug, env);
  if (!validation.valid) throw new Error(`INVALID_WORKSPACE_SLUG:${validation.reason}`);
  return normalizeHost(`${validation.slug}.${resolveTenantHostConfig(env).rootDomain}`);
}

export function workspaceUrlForSlug(slug: string, env: Environment = process.env): string {
  const host = workspaceHostForSlug(slug, env);
  const protocol = host.endsWith(".localhost") || host === "localhost" ? "http" : "https";
  return `${protocol}://${host}`;
}
