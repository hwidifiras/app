export function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/register") return true;
  if (pathname === "/signup" || pathname.startsWith("/signup/")) return true;
  if (pathname === "/find-workspace") return true;
  if (pathname === "/auth/activate") return true;
  if (pathname === "/forgot-password") return true;
  if (pathname === "/reset-password") return true;
  if (pathname === "/accueil") return true;
  if (pathname === "/homepage") return true;
  if (pathname === "/demo") return true;
  if (pathname === "/receipts/verify") return true;
  if (pathname.startsWith("/we-discipline")) return true;
  if (pathname.startsWith("/branding/")) return true;
  if (pathname.startsWith("/templates")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/saas-signup")) return true;
  if (pathname === "/api/health") return true;
  if (pathname === "/api/ready") return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/icon.png") return true;
  if (pathname === "/apple-icon.png") return true;
  return false;
}

const TENANT_INDEPENDENT_PUBLIC_PATHS = new Set(["/accueil", "/homepage", "/demo"]);

export function isTenantIndependentPublicPath(pathname: string | null): boolean {
  return pathname !== null && TENANT_INDEPENDENT_PUBLIC_PATHS.has(pathname);
}
