import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppSidebar } from "@/components/layout/app-sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GYM SaaS MVP",
  description: "Interface réception moderne pour la gestion du club",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <div className="grid min-h-screen lg:grid-cols-[264px_1fr]">
          <AppSidebar />
          <div className="min-w-0 bg-gradient-to-b from-white/35 via-white/10 to-transparent">{children}</div>
        </div>
      </body>
    </html>
  );
}
