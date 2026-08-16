import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { isPlatformHost } from "@/lib/tenant-host";

export async function requirePlatformPage(pathname: string): Promise<void> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (isPlatformHost(host)) return;

  const configuredUrl = process.env.PLATFORM_APP_URL?.trim();
  if (!configuredUrl) notFound();

  const target = new URL(pathname, configuredUrl);
  redirect(target.toString());
}
