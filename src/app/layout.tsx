import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { ClubBrandingProvider } from "@/components/layout/club-branding-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { getAppName } from "@/lib/app-name";
import { resolveClubBranding } from "@/lib/club-branding";
import { getClubSettings } from "@/lib/club-settings";
import { isPublicPath } from "@/lib/public-paths";
import { getAuthUser } from "@/lib/request-user";
import { isAdminOnlyPath, requiredPermissionForPath } from "@/lib/route-permissions";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init-script";
import "./globals.css";

const appName = getAppName();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: appName,
  description: "Interface réception moderne pour la gestion du club",
  appleWebApp: {
    capable: true,
    title: appName,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f9ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1628" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname");

  if (pathname && !isPublicPath(pathname)) {
    const user = await getAuthUser();
    if (!user) {
      redirect(`/login?next=${encodeURIComponent(pathname)}`);
    }

    const requiredPermission = requiredPermissionForPath(pathname);
    const denied =
      (isAdminOnlyPath(pathname) && user.role !== "ADMIN") ||
      (user.role !== "ADMIN" && requiredPermission !== null && !user.permissions.includes(requiredPermission));

    if (denied) {
      redirect("/?denied=1");
    }
  }

  const settings = await getClubSettings();
  const branding = resolveClubBranding(settings);

  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>
          <ClubBrandingProvider branding={branding}>
            <AppShell>{children}</AppShell>
          </ClubBrandingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
