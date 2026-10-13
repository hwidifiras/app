export function isAccountCreationDisabled() {
  return process.env.OFFLINE_DESKTOP === "1" && process.env.OFFLINE_ACCOUNT_CREATION_DISABLED === "1";
}
