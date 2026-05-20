"use client";

import { createContext, useContext } from "react";

import type { ClubBranding } from "@/lib/club-branding";

const ClubBrandingContext = createContext<ClubBranding | null>(null);

export function ClubBrandingProvider({
  branding,
  children,
}: {
  branding: ClubBranding;
  children: React.ReactNode;
}) {
  return <ClubBrandingContext.Provider value={branding}>{children}</ClubBrandingContext.Provider>;
}

export function useClubBranding(): ClubBranding {
  const ctx = useContext(ClubBrandingContext);
  if (!ctx) {
    throw new Error("useClubBranding must be used within ClubBrandingProvider");
  }
  return ctx;
}
