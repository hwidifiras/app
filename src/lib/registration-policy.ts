export type PublicRegistrationPolicy = {
  globallyEnabled: boolean;
  tenantEnabled: boolean;
  enabled: boolean;
};

export function isPublicRegistrationGloballyEnabled(
  value: string | undefined = process.env.ALLOW_PUBLIC_REGISTER,
): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function resolvePublicRegistrationPolicy(
  tenantEnabled: boolean,
  globalValue: string | undefined = process.env.ALLOW_PUBLIC_REGISTER,
): PublicRegistrationPolicy {
  const globallyEnabled = isPublicRegistrationGloballyEnabled(globalValue);
  return {
    globallyEnabled,
    tenantEnabled,
    enabled: globallyEnabled && tenantEnabled,
  };
}
