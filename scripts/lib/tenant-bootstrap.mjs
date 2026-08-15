function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveTenantBootstrapConfig(env = process.env, options = {}) {
  const explicitSlug = trimmed(env.TENANT_SLUG);
  const defaultSlug = trimmed(env.DEFAULT_TENANT_SLUG);
  const slug = explicitSlug || defaultSlug;
  const usesDefaultTenant = !explicitSlug || (Boolean(defaultSlug) && explicitSlug === defaultSlug);
  const explicitAliasProvided = Object.prototype.hasOwnProperty.call(env, "TENANT_ROOT_DOMAIN_ALIAS");

  const id =
    trimmed(env.TENANT_ID) ||
    (usesDefaultTenant ? trimmed(env.DEFAULT_TENANT_ID) : "") ||
    (slug ? `tenant_${slug.replace(/[^a-z0-9_-]/gi, "_")}` : "");
  const name =
    trimmed(env.TENANT_NAME) ||
    (usesDefaultTenant ? trimmed(env.DEFAULT_TENANT_NAME) : "") ||
    trimmed(options.fallbackName) ||
    slug;
  const rootDomainAlias = explicitAliasProvided
    ? trimmed(env.TENANT_ROOT_DOMAIN_ALIAS) || null
    : usesDefaultTenant
      ? trimmed(env.DEFAULT_TENANT_ROOT_ALIAS) || null
      : null;

  return { id, name, rootDomainAlias, slug };
}
