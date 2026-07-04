export function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/register") return true;
  if (pathname === "/forgot-password") return true;
  if (pathname === "/reset-password") return true;
  if (pathname === "/accueil") return true;
  if (pathname === "/homepage") return true;
  if (pathname.startsWith("/we-discipline")) return true;
  if (pathname.startsWith("/templates")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/icon.png") return true;
  if (pathname === "/apple-icon.png") return true;
  return false;
}
